import type { TrackSummary } from '#lib/tidal/models.js';
import {
	createQueueEntries as createEntries,
	createQueueEntry as createEntry,
	toDisplayTrack as stripEntry,
	type QueueEntry as GenericQueueEntry,
	type QueueEntryIdFactory
} from 'bragi-audio/player';

/**
 * Syn's queue identity, from `bragi-audio/player`, fixed to the TIDAL display track.
 *
 * `id` identifies the TIDAL recording; `entryId` identifies one occurrence, so
 * the same recording can intentionally appear more than once.
 */
export type QueueEntry = GenericQueueEntry<TrackSummary>;
export type { QueueEntryIdFactory };
export { isQueueEntryId } from 'bragi-audio/player';

export const createQueueEntry: (track: TrackSummary, entryId?: string) => QueueEntry = createEntry;

/** `currentTrack` and `history` are plain `TrackSummary` — never let an `entryId` leak there. */
export const toDisplayTrack: (entry: TrackSummary | QueueEntry) => TrackSummary = stripEntry;

export const createQueueEntries: (
	tracks: readonly TrackSummary[],
	createId?: QueueEntryIdFactory
) => QueueEntry[] = createEntries;
