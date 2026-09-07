import type { QueueEntry } from './queue-entry.js';

/** A queue entry's place after a reorder, in terms a screen reader can read out. */
export interface QueueMoveDescription {
	title: string;
	/** 1-based, because it is spoken to a person rather than used as an index. */
	position: number;
	total: number;
}

/**
 * Locate an entry in the queue so a reorder can be announced.
 *
 * Returns `null` when the entry is gone — a concurrent session may have removed
 * it between the click and the announcement, and silence beats a wrong position.
 */
export function describeQueueMove(
	queue: readonly QueueEntry[],
	entryId: string
): QueueMoveDescription | null {
	const index = queue.findIndex((entry) => entry.entryId === entryId);
	if (index < 0) return null;
	return { title: queue[index].title, position: index + 1, total: queue.length };
}
