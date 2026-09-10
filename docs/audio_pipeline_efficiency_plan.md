# Making the audio fetch → serve pipeline efficient

## Context

Playing a track in Syn is far more expensive than it looks. Two findings frame the work:

**There is no decryption step.** `src/lib/server/tidal/crypto.ts` is AES-256-GCM for _stored
OAuth token rows_, not media. `BTSManifest.encryptionType` is parsed at
[stream.ts:68](src/lib/server/tidal/stream.ts#L68) and never read; every fixture is `'NONE'`.
Audio bytes are served as plaintext from the CDN. So the pipeline is really **resolve → fetch
→ serve**, and the cost lives in _resolve_ and in the HiRes _fetch_.

**Every byte request re-resolves everything from scratch.** `/audio` has no memoisation at any
layer, so a single Range request — i.e. _every seek_ — pays:

| Step                                                              | Cost                                          |
| ----------------------------------------------------------------- | --------------------------------------------- |
| `getConnectionStatus()` → `readRecord()` + `readPlaybackRecord()` | 2 Postgres reads + 2 AES-GCM decrypts         |
| `getRequestedStreamQuality()` → `getStreamingSettings()`          | 1 Postgres read                               |
| `resolveTrackStream()` → `getPlaybackToken()`                     | 1 Postgres read + 1 decrypt                   |
| `fetchTrackStream()` → `playbackinfopostpaywall`                  | 1–4 sequential HTTPS calls to `api.tidal.com` |

**≈4 Postgres round-trips + 4 decrypts + ≥1 TIDAL API call before a single byte moves.**
`/stream` runs the same four steps independently and concurrently, so pressing play costs
_two_ full resolutions of the identical manifest.

Compounding this: `Cache-Control: no-store` on `/audio` forbids the browser from caching any
audio, so seeking backward re-pays the whole chain; the HiRes path buffers a whole track three
times over in memory before emitting a byte; and its cache is a 3-entry in-process `Map` that
dies on every `pm2:reload`.

**Outcome wanted:** seeks that cost ~0 server work, HiRes first-byte in ~100 ms instead of
1–3 s, and per-request memory that does not scale with track length.

Two pieces of infrastructure already exist and are underused — the plan builds on both rather
than adding new dependencies:

- [cache.ts](src/lib/server/cache.ts) — a bounded, **fail-open Redis cache** (`redisCache`),
  256 KB value cap, 300 s TTL cap. Currently used only by `taste/profile.ts`.
- [private-music/[id]/+server.ts](src/routes/api/private-music/[id]/+server.ts) — a
  **reference-quality range server** with `ETag`, `If-None-Match`→304, `If-Range`, 416, and a
  `HEAD` handler, already reusing `parseByteRange` from `segmented.ts`. `/audio` has none of it.

---

## Phase 1 — Stop re-resolving (biggest win, lowest risk)

### 1a. Delete the redundant `getConnectionStatus()` call in `/audio`

[audio/+server.ts:27-30](src/routes/api/tracks/[id]/audio/+server.ts#L27-L30) costs 2 Postgres
reads + 2 decrypts to produce an error the route **already handles**: `getPlaybackToken()`
throws `TidalPlaybackNotLinkedError` when no record exists
([client.ts:102](src/lib/server/tidal/client.ts#L102)), and the catch block at
[audio/+server.ts:43-49](src/routes/api/tracks/[id]/audio/+server.ts#L43-L49) maps that to the
identical 403 and message. The `configured` check is likewise subsumed by `getTidalConfig()`
throwing. Removing the call is behaviour-preserving and halves the DB work per request.

Keep it in `/stream`, which returns a richer status body.

### 1b. Cache the resolved manifest

Add `src/lib/server/tidal/stream-cache.ts` wrapping `resolveTrackStream`:

- **Key** `stream:v1:<trackId>:<requestedQuality ?? 'auto'>`.
- **Two tiers**: a process-local `Map` for zero-latency hits, backed by the existing
  `redisCache` so hits survive `pm2:reload` and are shared across Vercel lambdas.
- **Single-flight** an in-flight resolution per key — mirror the `inFlightPlaybackRefresh`
  pattern at [client.ts:105-117](src/lib/server/tidal/client.ts#L105-L117). This alone
  collapses the concurrent `/stream` + `/audio` pair on track start into one upstream call.
- **TTL 120 s.** CDN URLs in the manifest are short-lived signed capabilities; 120 s covers a
  seek burst with wide safety margin and stays under `cache.ts`'s 300 s cap.
- **Seal before Redis.** Cached `ResolvedStreamInfo` contains signed CDN URLs, which are
  bearer credentials. Reuse `seal`/`open` from
  [crypto.ts](src/lib/server/tidal/crypto.ts) with `getTidalConfig().encryptionKey` so the
  repo's "plaintext never leaves the process" posture holds for Redis exactly as it does for
  Postgres. The process-local tier stores the object unsealed.
- **Invalidate** on disconnect and on a `TidalQualityDeniedError`/401 retry.

Also memoise `getStreamingSettings` behind a short process-local TTL (~30 s) — single-user app,
changes are rare, and it sits in the hot path via `getRequestedStreamQuality`.

### 1c. Retry the hot-path calls

Neither `fetchTrackStream`'s call to `playbackinfopostpaywall`
([stream.ts:295](src/lib/server/tidal/stream.ts#L295)) nor any CDN/segment fetch goes through
`tidalFetch`, so **neither has any retry** — while the general JSON:API surface does
([client.ts:147-195](src/lib/server/tidal/client.ts#L147-L195), 2 retries, exponential backoff
on 408/5xx). A single transient 502 currently kills a play outright. Extract the retry helper
from `tidalFetch` and apply it to both. This is a reliability fix that also prevents the
user-visible retry cost of a failed play.

---

## Phase 2 — Let the browser cache audio

`/audio` sets `Cache-Control: no-store`
([audio/+server.ts:110](src/routes/api/tracks/[id]/audio/+server.ts#L110)), so every backward
seek, replay, and reload re-fetches from the server. The bytes are the owner's own on an
authenticated same-origin route.

- Emit `Cache-Control: private, max-age=600` and an `ETag` of
  `"<trackId>-<audioQuality>-<size>"`. Quality must be in the tag: the URL does not encode it,
  so a preference change would otherwise serve stale bytes at the wrong tier.
- Honour `If-None-Match` → 304 and `If-Range`, and add the missing **`HEAD`** handler (only
  `GET` is exported today, so a bare HEAD probe 404s).
- Copy the shape from
  [private-music/[id]/+server.ts](src/routes/api/private-music/[id]/+server.ts) — `entityTag`,
  `matchesEntityTag`, `responseHeaders` are all directly reusable; lift them to a shared module
  rather than duplicating.

---

## Phase 3 — Make HiRes stream instead of buffer

[segmented.ts:77-105](src/lib/server/tidal/segmented.ts#L77-L105) holds each track in memory
**three times** during assembly (N fragment buffers → merged copy → cached copy, a ~60 MB peak
for a 30 MB track) and emits nothing until the last fragment lands.

- **Zero-copy slices.** `bytes.slice(range.start, range.end + 1)`
  ([segmented.ts:181](src/lib/server/tidal/segmented.ts#L181)) copies on _every_ range request.
  `new Uint8Array(bytes, start, len)` is a view — `Response` accepts it without copying.
- **Free fragments as they merge.** Null out `parts[i]` after `merged.set(...)` to drop the
  peak from ~2× to ~1×.
- **Stream the first response.** Issue parallel `HEAD`s across all fragment URLs first (~1 RTT)
  to compute the exact total, set a correct `Content-Length`, then return a `ReadableStream`
  that enqueues fragments in order as they arrive while teeing into the cache. First byte
  drops from "whole track" to "first fragment". A correct up-front `Content-Length` also keeps
  seeking working immediately and avoids the `duration = Infinity` failure mode the
  `debug-playback` skill documents.
- **Single-flight the assembly.** Two concurrent first-plays of the same uncached track each
  run `downloadAndConcat` today. Reuse the same guard as 1b.

---

## Phase 4 — Durable HiRes cache (optional, larger)

The 3-entry / 128 MB / 5-min in-process `Map` cannot survive a reload or be shared. Stage
assembled tracks in the existing S3-compatible bucket instead
([private-music-bucket.ts](src/lib/server/private-music-bucket.ts)), whose `get(key, range)`
already returns a `ReadableStream` — so the app server range-serves without ever holding the
track in memory.

Needs a sibling module rather than edits in place: `validKey` there is hard-restricted to a
UUID under `halflight-private-music/v1/`. Use a distinct prefix (e.g. `syn-tidal-cache/v1/`)
and add a size/retention policy. Do this only if Phase 3 proves insufficient.

Note `syn-worker` is **not implemented** — `SYN_WORKER_*` appears in `CLAUDE.md` and
`MASTERPLAN.md` but in no code and not in `src/env.ts`. Don't plan around it.

### Implementation status

Phases 1–3 are complete: resolved manifests and settings are memoised, safe playback reads retry,
the browser can validate and reuse audio responses, and an opening HiRes request streams fragments
into one bounded assembly without copying Range slices. Cancellation now aborts pending fragment
fetches and never promotes an abandoned response into either cache.

Phase 4 has begun with a server-only `segment-cache-bucket.ts` adapter. It uses a separate
`HALFLIGHT_TIDAL_CACHE_BUCKET`, hashes the internal cache key into an opaque object key, limits an
object to 128 MiB, stamps every object with a 15-minute expiry, and fails open to the direct TIDAL
path. A completed assembly writes in the background; a durable cache hit streams through Syn with
Range support and never exposes a bucket URL. The feature is disabled until all five environment
variables are deliberately configured and `HALFLIGHT_TIDAL_CACHE_ENABLED=true` is set.

Before enabling it in any environment, record the provider-permission decision, provision a bucket
that is isolated from exports, private music, and worker media, and configure an object-lifecycle
rule that removes `syn-tidal-cache/v1/` objects no later than their expiry. The in-request expiry
check is a backstop, not a substitute for lifecycle deletion.

### Phase 4 activation gate

The implementation is intentionally **fail-closed at startup**: all dedicated bucket fields and
`HALFLIGHT_TIDAL_CACHE_ENABLED=true` must be present before it can read or write an object. Before
reloading a process with that switch enabled, confirm all of the following outside the application:

1. The bucket is isolated from exports, private music, and any worker/media store.
2. The provider-permission decision explicitly allows this short-lived assembly cache.
3. A bucket lifecycle rule deletes `syn-tidal-cache/v1/` objects at or before 15 minutes. The
   `Expires` header and object metadata are request-time backstops, not deletion machinery.
4. An owner smoke test confirms cache hits preserve `206`, `Content-Range`, and seek behaviour;
   then disable the bucket and confirm direct TIDAL playback still works.

Do not point this at an existing worker bucket as a shortcut, and do not activate it merely because
credentials happen to be available in an environment file.

---

## Files

| File                                           | Change                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/lib/server/tidal/stream-cache.ts`         | **new** — sealed two-tier manifest cache + single-flight                                   |
| `src/routes/api/tracks/[id]/audio/+server.ts`  | drop `getConnectionStatus`, use cache, ETag/304/`If-Range`, add `HEAD`                     |
| `src/routes/api/tracks/[id]/stream/+server.ts` | use the cache (shares the entry with `/audio`)                                             |
| `src/lib/server/tidal/segmented.ts`            | zero-copy slices, progressive free, streaming first response, single-flight                |
| `src/lib/server/tidal/client.ts`               | export the retry helper from `tidalFetch`                                                  |
| `src/lib/server/tidal/stream.ts`               | route `fetchTrackStream` through the retry helper                                          |
| `src/lib/server/http-range.ts`                 | **new** — `entityTag`/`matchesEntityTag`/range headers lifted from the private-music route |
| `src/lib/server/streaming-settings.ts`         | short process-local TTL memo                                                               |

## Verification

Unit (existing suites are a real safety net here — all node-only, no DB or network):

```sh
pnpm exec vitest run --project server src/lib/server/tidal/segmented.spec.ts
pnpm exec vitest run --project server src/lib/server/tidal/stream.spec.ts
pnpm exec vitest run --project server "src/routes/api/tracks/[id]/audio/+server.spec.ts"
```

New cases to add: cache hit avoids a second `resolveTrackStream`; concurrent resolutions share
one upstream call; sealed Redis payload round-trips; `If-None-Match` → 304; `HEAD` returns
headers with no body; streamed first response emits before the last fragment resolves.

End-to-end, in a browser with DevTools Network filtered to `/api/tracks/`:

1. Play a `LOSSLESS` track — confirm exactly **one** `playbackinfopostpaywall` call for the
   `/stream` + `/audio` pair, not two (add a temporary `console.error`; remove it after).
2. Seek repeatedly — confirm 206s served with no new upstream TIDAL call, and that a backward
   seek to an already-played region is served from the browser cache (`(disk cache)` / 304).
3. Play a `HI_RES_LOSSLESS` track — confirm time-to-first-byte drops from ~1–3 s to well under
   a second, and that the total-time readout is correct (not `0:00`, which is the
   `duration = Infinity` tell).
4. `pnpm build && pnpm pm2:reload`, then replay the same HiRes track — with Redis reachable the
   manifest should still be warm.
5. Stop Redis entirely and repeat step 1 — the cache is fail-open, so playback must still work,
   just slower.

Gate before pushing:

```sh
pnpm format && pnpm check && pnpm lint && pnpm lint:types && pnpm test:unit -- --run
```

`lint:types` matters here — this change is almost entirely async/token code.

Confirm no debug logging or CDN URLs leaked:

```sh
git diff | grep -nE '^\+.*(console\.(log|debug|warn|error)|streamUrl)' && echo 'LEFTOVER DEBUG CODE'
```
