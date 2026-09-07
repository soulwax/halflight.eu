# Queue and resume-position desync

Read `docs/playback-session-protocol.md` first — it is the contract. **But note it is
partly behind the code**: it describes named idempotent queue intents as the "next
contract", while `player.svelte.ts` already posts `version: 2` intents to
`/api/playback-state/intents`. Trust the code for current behaviour and the doc for
intent and rollout rules.

The rule that governs every decision here: **persistence state is separate from
transport state.** A conflict, a failed refresh, or an offline write must never clear the
local queue or stop the audio. If you find a code path where it does, that's the bug —
don't "fix" it by making persistence more aggressive.

## The write pipeline

One ordered write stream per tab, from `persistPlaybackState()`:

1. Changes are debounced 500 ms. An in-flight write is never replaced — a later change
   sets `persistenceQueued` and is sent after the current write settles.
2. If `queueCommands` is non-empty, `persistQueueCommands()` runs **first**, draining
   commands one at a time to `POST /api/playback-state/intents` with
   `{ version: 2, expectedRevision, operationId, origin, intent }`.
3. Then the resume snapshot goes to `PUT /api/playback-state` (the v1 shape:
   `currentTrack`, `queue`, `history`, `currentTime`, `revision`, `origin`).

Both writes are conditional on `revision`. A match increments it and returns `200`; a
stale write changes nothing and returns `409` with the authoritative state.

## `persistenceStatus` is your main signal

`'saved' | 'saving' | 'offline' | 'conflict'` (`player.svelte.ts:44`). Read it before
anything else:

| Status     | Means                                             | Next step                                                                                                                   |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `saved`    | Last write accepted                               | Desync is not in persistence — look at `switchToTrack` field resets                                                         |
| `saving`   | Write in flight or queued                         | Not yet a bug; wait past the 500 ms debounce                                                                                |
| `offline`  | Response missing, malformed, or non-OK            | Network, or the server returned a body that failed the shape check (`Array.isArray(state.queue)` + safe-integer `revision`) |
| `conflict` | Second consecutive 409 — automatic writes stopped | `refreshQueueFromServer()` is the only way out; it is gated on this exact status                                            |

`offline` on a _well-formed_ failure is worth pausing on: the client treats a malformed
200 exactly like a network failure. If the server changed its response shape, you'd see
`offline` with no network error in DevTools — a genuinely confusing combination.

## Conflict handling, precisely

`reconciliationAttempts` allows exactly **one** automatic retry:

- **First 409** — take the returned state as `reconciliationBase`, adopt its `revision`,
  `rebaseQueue(state.queue, this.queueCommands, MAX_QUEUE_LENGTH)`, increment attempts,
  and retry once.
- **Second 409** — `persistenceStatus = 'conflict'`, automatic writes stop. The user
  needs an explicit refresh.
- The retry deliberately keeps **current track, history, and position from the
  reconciliation base**, not from the local tab. This is why a second tab does not steal
  the audible track. If someone reports "my other tab hijacked playback", that
  intentional behaviour is what they're arguing with.
- Any success resets `reconciliationBase = null` and `reconciliationAttempts = 0`.

`switchToTrack()` also clears `reconciliationBase` — a deliberate track change re-asserts
local ownership of the current-track fields.

## `rebaseQueue` and the duplicate-track limitation

`playback-reconciliation.ts` replays local commands over the authoritative queue:
`append`, `prepend`, `remove`, `move`, `clear`, `replace`, truncating to `maximumLength`
after every command.

`remove` and `move` address an **`entryId`** — an opaque per-occurrence ID independent of
the TIDAL track ID (`queue-entry.ts`, guarded by `isQueueEntryId`). That is what makes
two deliberate copies of the same track independently removable.

The protocol doc's "current limitation" section describes v1 matching by `trackId`, which
could not distinguish duplicates. The entry-ID path is implemented — so if you're
debugging a duplicate-track queue bug, check whether the entries actually carry valid
IDs (`isQueueEntryId` returns `false` → `removeByEntryId` silently returns `null` and the
command is a **no-op**). A silently dropped command is the most likely cause of "I
removed it and it came back".

`move` falls back through `beforeEntryId` → `afterEntryId` → append at the end. So a move
whose anchor is gone lands the entry at the tail rather than failing — expected, and a
plausible explanation for "the track jumped to the bottom".

## Bounds that silently drop data

Server-side validation (Valibot on the envelope, then per-track): **at most 100 queued
tracks and 50 history entries**; `currentTime` is whole seconds, 0–86,400. An invalid
current track **rejects the whole snapshot**; invalid entries inside queue or history are
**dropped individually and silently**. So a queue that comes back shorter than it went
out is validation, not a client bug — check the track shapes.

## Reproduce

`rebaseQueue` and the entry-ID helpers are pure:

```sh
pnpm exec vitest run --project server src/lib/player/playback-reconciliation.spec.ts
pnpm exec vitest run --project server src/lib/player/queue-entry.spec.ts
pnpm exec vitest run --project server src/routes/api/playback-state/+server.spec.ts
pnpm exec vitest run --project server src/routes/api/playback-state/intents/+server.spec.ts
```

For genuine two-writer races, two browser tabs on `pnpm dev` is the only real
reproduction — there is no e2e harness. Drive one tab's queue, then the other's, and
watch `persistenceStatus` and the returned revisions.
