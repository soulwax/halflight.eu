import type { TrackSummary } from '#lib/tidal/models.js';
import {
	rebaseQueue as rebase,
	type QueueCommand as GenericQueueCommand
} from 'bragi-audio/player';
import type { QueueEntry } from './queue-entry.js';

/**
 * Queue edits made after the last accepted playback-state revision, rebased
 * onto the server queue after a 409 (see `docs/playback-session-protocol.md`).
 */
export type QueueCommand = GenericQueueCommand<TrackSummary>;

export const rebaseQueue: (
	remoteQueue: QueueEntry[],
	commands: readonly QueueCommand[],
	maximumLength: number
) => QueueEntry[] = rebase;
