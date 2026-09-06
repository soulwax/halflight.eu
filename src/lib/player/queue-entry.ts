import type { TrackSummary } from '#lib/tidal/models.js';

/**
 * A specific occurrence of a track in a listening queue.
 *
 * `track.id` identifies the TIDAL recording. `entryId` identifies this
 * occurrence, so the same recording can intentionally appear more than once.
 */
export interface QueueEntry extends TrackSummary {
	entryId: string;
}

export type QueueEntryIdFactory = () => string;

const queueEntryIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/** Whether a queue entry identifier is safe to use in client state and URLs. */
export function isQueueEntryId(value: unknown): value is string {
	return typeof value === 'string' && queueEntryIdPattern.test(value);
}

/** Mint an opaque, client-safe identifier for one queue occurrence. */
export function mintQueueEntryId(): string {
	return `queue_${crypto.randomUUID()}`;
}

/**
 * Attach a stable queue-occurrence identity to a display track.
 *
 * Call this once as legacy `TrackSummary` values enter queue state. Keep the
 * resulting `QueueEntry` objects for every subsequent queue operation.
 */
export function createQueueEntry(track: TrackSummary, entryId = mintQueueEntryId()): QueueEntry {
	if (!isQueueEntryId(entryId)) {
		throw new Error('Queue entry IDs must contain only letters, numbers, underscores, or hyphens.');
	}

	return { ...track, entryId };
}

/**
 * Drop the queue-occurrence identity when a queued entry leaves the queue to
 * become the current track. `currentTrack` and `history` are plain
 * `TrackSummary` — a stray `entryId` there would leak into persistence and
 * confuse identity comparisons.
 */
export function toDisplayTrack(entry: TrackSummary | QueueEntry): TrackSummary {
	if (!('entryId' in entry)) return entry;
	const { entryId: _entryId, ...track } = entry;
	return track;
}

/**
 * Upgrade a legacy queue of tracks to independently addressable entries.
 *
 * The injected factory keeps this pure helper deterministic in tests. It must
 * return unique, safe IDs because duplicate IDs would make queue operations
 * ambiguous again.
 */
export function createQueueEntries(
	tracks: readonly TrackSummary[],
	createId: QueueEntryIdFactory = mintQueueEntryId
): QueueEntry[] {
	const entryIds = new Set<string>();

	return tracks.map((track) => {
		const entryId = createId();
		if (entryIds.has(entryId)) {
			throw new Error('Queue entry IDs must be unique.');
		}
		entryIds.add(entryId);
		return createQueueEntry(track, entryId);
	});
}
