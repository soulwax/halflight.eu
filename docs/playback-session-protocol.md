# Playback session protocol

The playback session is one owner’s accepted resume state. The server is authoritative; a client may
keep playing while a write is pending, but it must not make an accepted revision appear newer than it
is. This document describes the current snapshot contract and the deployment rules for its next
versions.

The implementation lives in:

- `src/routes/api/playback-state/+server.ts`
- `src/lib/server/playback-state.ts`
- `src/lib/player/player.svelte.ts`
- `src/lib/player/playback-reconciliation.ts`

## Current contract (v1)

`GET /api/playback-state` returns the owner’s accepted state. `PUT /api/playback-state` accepts a
JSON snapshot only from the authenticated administrator.

```ts
type Origin = 'listening-room' | 'halflight-now';

type PlaybackSnapshot = {
	currentTrack: TrackSummary | null;
	queue: TrackSummary[];
	history: TrackSummary[];
	currentTime: number; // whole seconds, 0 through 86,400
	revision: number; // non-negative integer expected by PUT
	origin: Origin; // required by PUT
	queueCommands?: QueueCommand[];
};
```

A `GET` response replaces `origin` with `lastOrigin`, the origin that produced the accepted
revision. A client must not send `lastOrigin` in place of `origin`.

The server validates the outer envelope with Valibot, then validates and bounds every persisted
track. It keeps at most 100 queued tracks and 50 history tracks. An invalid current track rejects the
snapshot; invalid entries within queue or history are dropped. The optional `queueCommands` field is
validated so unknown commands cannot enter the protocol, but **v1 persists the snapshot, not the
commands**. Commands are currently local reconciliation intent.

The database write is conditional on `revision` matching the accepted revision. A successful write
increments it by one and returns `200` with the new state. A stale write changes nothing and returns
`409` with the latest accepted state. The origin is restricted to the two named product surfaces.

No provider token, stream URL, audio, artwork blob, lyric document, or raw TIDAL response belongs in
this payload or in the persisted session.

## Client reconciliation

The mounted player is responsible for one ordered write stream per tab.

1. Queue and position changes are debounced for 500 ms. An in-flight write is never replaced; a later
   change is marked queued and sent only after that write finishes.
2. Queue edits record bounded local commands: append, prepend, remove, move, clear, or replace.
3. On the first `409`, the player takes the returned server state as its reconciliation base, rebases
   its local commands over the returned queue, and performs one conditional retry using the returned
   revision.
4. The retry keeps the current audible track, history, and position from the reconciliation base. It
   therefore does not claim that a local tab has taken over remote audio or position.
5. A second conflict stops automatic writes and exposes an explicit queue refresh. Refresh reads the
   latest server state, replays the local commands over its queue, and attempts one new conditional
   write. Network or validation failure leaves the player usable and reports unsaved state.

A `409`, a failed refresh, or an offline persistence failure must never clear the local queue or stop
the media element. Persistence state is separate from transport state.

### Current limitation: duplicate tracks

v1 identifies a queued occurrence by its TIDAL `trackId`. Reconciliation removes or moves the first
matching occurrence. It is safe for distinct tracks, but cannot distinguish two deliberate copies of
the same track. Until stable queue-entry IDs ship, clients must present this as a known protocol
limitation and avoid treating a duplicate-targeted edit as conflict-proof.

## Next contract: named, idempotent queue intents

A later version must be explicitly versioned; it cannot reinterpret a v1 snapshot in place. Its
minimum request shape is:

```ts
type QueueIntent = {
	protocolVersion: 2;
	expectedRevision: number;
	operationId: string;
	origin: Origin;
	type: 'append' | 'prepend' | 'remove' | 'move' | 'clear' | 'replace';
	payload: unknown; // validated per command
};
```

Every queued occurrence receives an opaque `entryId`, generated once and independent of the TIDAL
track ID. Remove and move address `entryId`; append/prepend/replace carry entries with their IDs.
The server validates the named intent, applies it and increments the revision in one transaction, and
stores a bounded recent-operation result in that same transaction. Retrying the same `operationId`
returns its original result without applying the edit twice.

Position ownership is a separate addition. A server-issued device lease/epoch determines which device
may persist position. Queue edits do not create audio, and an explicit “Play here” action is required
to take the lease. Visibility-aware reads and polling may consume committed revisions, but never
bypass a lease or replay a stale write.

## Rollout order

1. **Additive database migration first.** Add nullable/versioned fields and the bounded operation
   result store. Backfill existing snapshots to v1-compatible entries. Do not remove or repurpose
   `playback_state` fields in this release.
2. **Compatible server second.** Deploy a server that reads v1 and v2, validates each independently,
   and writes the appropriate representation atomically. It must continue serving the current and
   immediately previous released client. Keep v1 snapshots accepted while that client window exists.
3. **Client last.** Release a client that negotiates v2 before writing it and retains its v1 recovery
   path. Only enable v2 writes after the compatible server is live. A client that cannot use the
   accepted protocol may read its session but must be asked to update before it makes a destructive
   write.
4. **Observe before tightening.** Exercise two-client append/remove/move races, duplicate request
   delivery, lost responses, reload, and database failures while synthetic audio continues. Record
   only safe operation categories, revisions, status, and latency.
5. **Retire deliberately.** After the supported client window and operation-result retention window
   have elapsed, remove v1 writes in a later release. Keep a read/migration path for existing rows
   until the data migration is complete and verified.

## Rollback order

- Roll back the **client** by serving the prior immutable assets only while the server still accepts
  its protocol. Do not roll back to a client that can issue destructive writes the server has made
  incompatible.
- Roll back the **server** to the previous compatible release before considering any schema change.
  Additive migrations remain in place; do not drop new fields or operation records as part of an
  incident rollback.
- If a v2 client is already active, the rollback server must still parse v2 and return a clear
  update-required response when it cannot safely process a write. It must never reinterpret a v2
  intent as a v1 snapshot.
- Treat a service-worker rollback separately from a server rollback. Retain prior immutable assets for
  the supported client window and use a same-scope recovery worker that clears only Halflight-owned
  caches. Never broadly clear origin storage or unregister unrelated workers.

The success condition is unchanged across versions: one stale write loses without losing deliberate
intent, accepted state survives reload, and audio continues throughout reconciliation.
