# Stalls, buffering, and broken seeking

Seeking works only if the byte leg honours HTTP Range. The two delivery paths get there
completely differently, so the first question is always **which path is this track on**.

## Which path?

`LOW` / `HIGH` / `LOSSLESS` are single-file BTS streams — proxied byte-for-byte with the
incoming `Range` header forwarded to the CDN.

`HI_RES_LOSSLESS` is segmented MPEG-DASH: an `initialization` segment plus numbered
fragments, with **no single URL to range against**. `streamSegmentedAudio` fetches every
fragment (6 at a time, order preserved by indexed writes), concatenates them into one
fMP4 buffer, caches it, and serves real Range slices from memory.

Tell them apart from the `/stream` response: `delivery` (from `describePlaybackDelivery`),
plus `audioQuality`. Or from the `/audio` response: the segmented path always sets
`Content-Length` to the **whole** concatenated size.

## Single-file path

Range forwarding is a straight pass-through. Check, in order:

1. Does the `/audio` response carry `Accept-Ranges: bytes` and, for a ranged request,
   `206` with `Content-Range`? The route copies `content-length` and `content-range`
   from upstream — if upstream sent neither, the browser cannot seek.
2. Did upstream return `200` for a ranged request? Then the CDN ignored the Range and
   the browser will re-download from zero on every seek. Look at whether the `Range`
   header actually reached it (`headers.set('Range', range)` only fires when the
   incoming request had one).
3. `Content-Type` — the route only trusts upstream's value if it starts with `audio/`,
   otherwise it substitutes `stream.mimeType`. A wrong type here surfaces as
   `MediaError.code === 4`.

## Segmented path

First play buffers the **entire track** (~15–30 MB, ~1–3 s for a 4-minute 24/96 track)
before a single byte is served. That is by design, not a stall — but it means a slow
network reads as a hang with no progress indication.

Failure points:

- **`SegmentFetchError`** — one fragment returned non-2xx/206. Surfaces as
  `502 CDN unreachable` with `log.error('audio proxy: segmented fetch failed')`. Because
  fragments are fetched concurrently, one expired URL kills the whole track.
- **Cache behaviour** — `MAX_ENTRIES = 3`, `MAX_TOTAL_BYTES = 128 MB`, `TTL_MS = 5 min`,
  keyed `${trackId}:${audioQuality}`. Re-inserted on read, so it is a true LRU. Playing a
  fourth HiRes track evicts the first; returning to it re-downloads everything. Under PM2
  this cache dies on every `pm2:reload` — a "first play is slow again" report after a
  deploy is expected, not a bug.
- **416 responses** — `parseByteRange` returns `null` for a malformed or
  out-of-bounds range and the route answers `416` with `Content-Range: bytes */<size>`.
  Suffix ranges (`bytes=-N`) and open-ended (`bytes=N-`) are both handled; `bytes=-0`
  and `start >= size` are rejected. This is pure and directly testable.
- **Decode failure (`MediaError.code === 3`)** on HiRes only points at the concatenation:
  a missing init segment or out-of-order fragments produce a plausible-sized but
  unplayable fMP4. Check that `parsed.urls[0]` is the init segment.

```sh
pnpm exec vitest run --project server src/lib/server/tidal/segmented.spec.ts
pnpm exec vitest run --project server src/lib/server/tidal/stream.spec.ts
```

## There is no stall recovery — verify this before theorising

The live element wiring in `player.svelte.ts:242` (`initAudio`) attaches exactly these
listeners: `timeupdate`, `durationchange`, `loadedmetadata`, `progress`, `waiting`,
`playing`, `play`, `pause`, `ended`, `error`.

Note what is **absent**: there is no `stalled` listener and no watchdog. `waiting` only
sets `isBuffering = true`. So a stream that stops delivering bytes without erroring
**hangs indefinitely** — buffering state on, no timeout, no retry, no embed fallback, and
nothing logged. "It just sits there spinning" is the expected shape of that bug, not a
mystery, and adding recovery is a fix rather than a repair.

`src/lib/player/audio-engine.ts` _does_ contain a 3.5 s stall watchdog with a
`currentTime` re-assignment nudge. It is dead code and never runs. Do not reason about
stall behaviour from it, and do not "fix" a stall by editing it — see below.

The only self-healing that does run is `resumeAudioContext()` on `visibilitychange` and
`online`, which re-arms a suspended `AudioContext` after a tab wake. That addresses
silence after sleep, not a mid-track stall.

## Duration is the hidden variable in every seek bug

Before blaming the byte layer, check what `player.duration` actually holds. The metadata
guard at `player.svelte.ts:251` is:

```ts
if (this.audio && !isNaN(this.audio.duration) && this.audio.duration > 0)
```

`Infinity` passes **both** checks, so a stream whose duration the element cannot
determine sets `duration = Infinity` rather than being rejected. That single value
degrades a lot of UI at once: `max="Infinity"` is not a valid HTML float so the range
input silently falls back to a 0–100 scale, any `currentTime / duration` fill fraction
collapses to 0, a clock formatter renders `0:00`, and `assessPlayback`'s `finitePositive`
maps it to `null` — which means **no warning badge ever appears** to tell you something
is wrong. Check the total-time readout first: `0:00` on a track you know the length of is
the tell.

`seek()` (`:795`) also assigns `this.currentTime = target` _before_ writing
`this.audio.currentTime`. So the thumb moves even when the element ignores the seek
entirely, and the next `timeupdate` snaps it back. A bar that jumps and returns means the
element rejected the seek — it does not mean the seek code is broken.

Buffer percentage comes from `updateBuffer()` (`:307`), which walks `audio.buffered` for
the range containing `currentTime` and falls back to the highest range's end. It divides
by `this.audio.duration`, so a bar stuck at 0 has two very different causes: the concat
never completed, **or** the concat completed fine and the duration is `Infinity`.
Distinguish them by the transferred size of the `/audio` response before concluding
anything — the bar alone cannot tell you which.

## Do not debug `audio-engine.ts`

`src/lib/player/audio-engine.ts` contains a complete, well-formed copy of this logic —
watchdog, buffer math, Web Audio gain graph — and **nothing imports it**. The live code
is inline in `player.svelte.ts`. Verify before editing:

```sh
grep -rn "AudioEngine" src/ | grep -v "player/audio-engine.ts"
```

No output means the file is dead. Either fix the real one in `player.svelte.ts`, or
raise deleting the duplicate as a separate cleanup — don't silently patch both.
