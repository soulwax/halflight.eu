---
name: debug-playback
description: Diagnose and fix audio playback failures in Syn — a track that won't play, the TIDAL embed badge appearing instead of direct playback, stalls or dead seeking, wrong quality tier or a preview served as a full track, and queue/resume position desync (409 conflicts). Use this whenever someone reports that playback, the player, the queue, streaming, seeking, buffering, audio quality, or the resume position is broken or behaving oddly in this repo, and also when working on src/lib/player/, src/lib/server/tidal/stream.ts, segmented.ts, or the /api/tracks/[id]/stream and /audio routes — the failure signals here are sparse and asymmetric, so guessing from source alone reliably wastes an hour on the wrong layer.
---

# Debugging Syn playback

Playback spans four layers and fails silently at most of them. The player's error
handling is deliberately forgiving — nearly every failure converges on one visible
outcome, the TIDAL embed badge — so the symptom you see tells you almost nothing about
which layer broke. This skill exists to stop you from reading plausible code and
concluding you found it.

Work the signal, not the source. Change the signal to confirm a cause.

## The path a track takes

```
Player.svelte (thin) ─ components/player/*
        │ reads/drives
player  ─ src/lib/player/player.svelte.ts   ← the $state singleton, owns the <audio> element
        │ switchToTrack() resets ~20 fields, then loadAndPlayStream(trackId)
        │
        ├─ METADATA leg ── streamPreloader.consume(id)   ← cache hit SKIPS the fetch
        │                  else GET /api/tracks/[id]/stream   → JSON, no bytes
        │
        └─ BYTE leg ────── audio.src = /api/tracks/[id]/audio
                                  │
                           resolveTrackStream()  src/lib/server/tidal/stream.ts
                                  │   walks QUALITY_LADDER down past subStatus 5003
                           fetchTrackStream()  → api.tidal.com/v1/…/playbackinfopostpaywall
                                  │   (Bearer = playback token, getPlaybackToken)
                                  │   parses BTS or DASH manifest
                                  ├─ single-file  → global fetch(CDN) + Range forwarding
                                  └─ segmented    → streamSegmentedAudio() concat + LRU
```

Both legs call `getRequestedStreamQuality(url, userId)` so they cannot disagree about the
tier being requested. Both gate on `locals.user && locals.isAdministrator`.

## What you can actually observe

This inventory is the whole point. There is **no `console.*` anywhere in
`src/lib/player/`**, and server logging is three call sites deep in one route.

| Signal                            | Where                                     | What it proves                                                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/stream` body `error` field      | DevTools Network tab                      | **The real discriminator.** `not_connected`, `playback_unauthorized`, `track_unavailable`, `plan_no_streaming`, `stream_unavailable`.                                                                            |
| `player.playbackReason`           | `$state`, `player.svelte.ts:116`          | Set only by the metadata leg, but **write-only** (no reader outside `player.svelte.ts`) and usually just `http_403`. See below.                                                                                  |
| `player.playbackMode === 'embed'` | `:103`                                    | Catch-all failure. Set from four places: the `<audio>` `error` event (`:287`), `play()` rejection after a good load (`:748`), no metadata at all (`:761`), and `play()` rejection in `togglePlayPause` (`:785`). |
| `player.requiresFullAuth`         | `:116` area                               | Device (playback) token missing or rejected.                                                                                                                                                                     |
| `player.assessment`               | `$derived`, `:385`                        | `assessPlayback` verdict — short stream, preview, downgraded tier. Drives the badge.                                                                                                                             |
| `log.error('audio proxy: …')`     | `routes/api/tracks/[id]/audio/+server.ts` | The only server-side playback logging that exists: segmented fetch failed, CDN fetch threw, CDN returned an error.                                                                                               |

### The asymmetry that decides your first move

Only the metadata leg records anything about its own failure. So:

- **`/stream` returned non-2xx** → the metadata leg failed. Go to
  `references/silent-and-embed.md`.
- **`/stream` returned 2xx and the embed badge appeared** → the **byte leg** failed.
  Nothing recorded why. Read the `/audio` request in the Network tab or the PM2 log — do
  not go re-reading `/stream` code.

**Do not lean on `playbackReason` to make this call.** Two verified limitations:

1. It is **write-only** — assigned at `:716`/`:719` and read nowhere else in the repo, no
   component renders it. You cannot see it without adding instrumentation.
2. It is usually uninformative anyway. The client reads `errData.reason`
   (`:716`), but `/stream` sends a `reason` field in **one of its six** error branches
   (`not_linked`). The other five send only `error`, so `not_connected`,
   `track_unavailable`, `plan_no_streaming`, `playback_unauthorized` and
   `stream_unavailable` all collapse into a bare `http_503`/`http_404`/`http_403`.

Read the `/stream` **response body** in the Network tab and use its `error` field — that
distinction is free there and destroyed by the time it reaches `playbackReason`. Making
the client read `errData.error` is a small, high-value fix if you are already in here.

The `player` singleton is not exposed on `window`, so you cannot read these fields from
the DevTools console directly. You don't need to: the **Network tab answers the same
question**. Filter to `/api/tracks/` and look at whether the `/stream` request returned
2xx. If it did and the embed badge is showing, you are on the byte leg. The rendered
badges corroborate it — `NowPlaying.svelte:45` shows the embed badge,
`SourcePanel.svelte` renders direct-mode detail only when `playbackMode === 'direct'`.

Watch for the case where **no `/stream` request appears at all**: that is
`streamPreloader` serving a cached entry, not a fetch that failed. See the traps below.

## Traps that cost real time

- **`src/lib/player/audio-engine.ts` is dead code.** Nothing imports `AudioEngine`. The
  live element wiring is inlined in `player.svelte.ts` (`initAudio`, ~`:200`–`:300`).
  Editing `audio-engine.ts` changes nothing at runtime and every test still passes.
  Confirm with `grep -rn AudioEngine src/ | grep -v player/audio-engine.ts` before
  touching it — if that prints nothing, you are in the wrong file.
- **`streamPreloader` can serve stale metadata.** 5-minute TTL, 5 entries,
  `consume()` deletes on read. A track queued a moment ago may never re-hit `/stream`,
  so a `/stream` fix can look like it did nothing. Reload the page between attempts.
- **The CDN must be fetched with the global `fetch`, never `event.fetch`.** SvelteKit's
  wrapper attaches request context the media CDN 403s on, surfacing as a 502 from the
  audio route. Both the single-file and segmented paths pass global `fetch` on purpose.
  Note `StreamSegmentedOptions.fetchImpl` is documented as "SvelteKit `event.fetch`" —
  that doc comment is stale; the route deliberately passes the global. Don't "fix" it.
- **`log` keeps only `Error.name`, never the message** (`src/lib/server/log.ts`). A
  logged `cause` tells you the class of failure, not the reason. That is deliberate
  policy — provider error text can carry signed URLs and personal data. Get the detail
  with temporary local logging, not by loosening the redactor.
- **Never log `stream.streamUrl` or manifest URLs.** The CDN token lives in the query
  string; it is a bearer credential.

## Workflow

1. **Split metadata leg vs byte leg** using the asymmetry above, before reading any
   player code. This one split eliminates roughly half the stack.
2. **Open the matching reference file** and work its checks in order:
   - `references/silent-and-embed.md` — won't play, embed fallback, auth/entitlement.
   - `references/stalls-and-seeking.md` — starts then hangs, scrubbing dead, 416/502,
     segmented DASH, Range forwarding, duration.
   - `references/quality-and-preview.md` — wrong tier, preview-as-full-track, codec and
     ladder behaviour.
   - `references/session-state.md` — queue or resume position wrong, 409 conflicts.
3. **Reproduce against the pure modules where you can.** Manifest parsing
   (`stream.spec.ts`), Range math (`segmented.spec.ts`), verdicts
   (`playback-assessment.spec.ts`), queue rebasing (`playback-reconciliation.spec.ts`)
   all run with no DB, network, or browser. A green suite here is a genuine result: it
   moves the cause up a layer rather than leaving it unlocated.
4. **Confirm by flipping the signal** — make the suspected cause start and stop on
   demand and watch the observable follow. This stack punishes plausible theories
   specifically because the embed fallback makes most of them look consistent with the
   evidence, so a cause you cannot toggle is still a guess.

## Environments

**Local (`pnpm dev`)** — the default. DevTools Network tab filtered to `/api/tracks/`
shows both legs; the `/audio` request's status, `Content-Type`, `Content-Range` and
transferred size answer most byte-leg questions on their own. Requires an owner session.

**PM2 (`halflight.eu`)** — `pnpm pm2:logs`, or `pm2 logs syn --lines 200`. Production
emits one JSON line per event, dev a readable line. **Source edits do not hot-reload
here**: `pnpm build && pnpm pm2:reload`. Reach for this only for failures that don't
reproduce locally — a stale token row, a real CDN 502, entitlement changes.

**Tests / reading only** — fastest for anything pure. `--project server` is node-only and
needs no browser.

Use `pnpm exec vitest run --project server <file>` to run one file. The
`pnpm test:unit -- --run --project server <file>` form documented in `CLAUDE.md` does
**not** filter — pnpm swallows the arguments and it runs all 138 files across every
project (~39 s, and it needs Playwright Chromium). `pnpm exec` is ~277 ms for one file.
Keep `pnpm test:unit -- --run` for the final gate, where running everything is the
point. `client` and `storybook` projects need Playwright Chromium
(`pnpm test:e2e` installs it). Svelte async mode is disabled under vitest, and
`expect.requireAssertions` is on — an assertion-free test fails.

There are currently **no e2e tests** (`testMatch: '**/*.e2e.{ts,js}'` matches nothing),
so there is no scripted way to drive real playback. Manual reproduction in a browser is
expected for anything that needs a live session.

## Temporary instrumentation

The observability gap is real, so adding traces is often the right move — but they are
**temporary**, and removing them is part of the fix, not an afterthought. Committed
debug logging in this stack risks leaking signed CDN URLs, and the redaction in
`src/lib/server/log.ts` exists precisely to prevent that.

Useful probes:

```ts
// player.svelte.ts, in loadAndPlayStream — which leg, and what did it say
console.debug('[syn] stream leg', { trackId, status: res?.status, reason: this.playbackReason });

// player.svelte.ts, in initAudio — the byte leg's only real error detail
this.audio.addEventListener('error', () => {
	const e = this.audio?.error;
	console.debug('[syn] audio error', {
		code: e?.code,
		message: e?.message,
		networkState: this.audio?.networkState,
		readyState: this.audio?.readyState
	});
});
```

`MediaError.code`: `1` aborted · `2` network · `3` decode · `4` src not supported.
Code 4 usually means the response `Content-Type`/codec is wrong for the container;
code 3 on a HiRes track points at the segment concatenation.

Server side, `log.error(…, { cause })` will only ever print the error's class name. To
see the actual reason during a session, add a bare `console.error(cause)` next to it —
then delete it.

**Before saying you're done**, prove nothing leaked out:

```sh
git diff | grep -nE '^\+.*(console\.(log|debug|warn|error)|streamUrl)' && echo 'LEFTOVER DEBUG CODE'
```

## Finishing

Run and report the real result:

```sh
pnpm check && pnpm lint && pnpm test:unit -- --run
```

Run `pnpm format` if you edited files, and `pnpm lint:types` if the change touched async
or token code. Report what the root cause turned out to be and which signal confirmed it
— on a stack this quiet, the next person needs the trail more than the patch.
