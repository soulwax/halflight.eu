import { isQueueEntryId, type QueueEntry } from './queue-entry.js';

/**
 * Queue edits made after the last accepted playback-state revision. They are
 * deliberately expressed as commands rather than another full snapshot so a
 * 409 response can be rebased on the server queue without replacing it.
 *
 * Entry IDs identify a queue occurrence independently of its TIDAL track ID.
 * This keeps deliberate duplicate tracks independently removable and movable.
 */
export type QueueCommand =
	| { type: 'append'; entries: QueueEntry[] }
	| { type: 'prepend'; entry: QueueEntry }
	| { type: 'remove'; entryId: string }
	| { type: 'move'; entryId: string; beforeEntryId?: string; afterEntryId?: string }
	| { type: 'clear' }
	| { type: 'replace'; entries: QueueEntry[] };

function removeByEntryId(queue: QueueEntry[], entryId: string): QueueEntry | null {
	if (!isQueueEntryId(entryId)) return null;
	const index = queue.findIndex((entry) => entry.entryId === entryId);
	return index === -1 ? null : (queue.splice(index, 1)[0] ?? null);
}

/** Reapply deliberate local queue commands to an authoritative remote queue. */
export function rebaseQueue(
	remoteQueue: QueueEntry[],
	commands: readonly QueueCommand[],
	maximumLength: number
): QueueEntry[] {
	let queue = remoteQueue.slice(0, maximumLength);

	for (const command of commands) {
		switch (command.type) {
			case 'append':
				queue.push(...command.entries);
				break;
			case 'prepend':
				queue.unshift(command.entry);
				break;
			case 'remove':
				removeByEntryId(queue, command.entryId);
				break;
			case 'move': {
				const entry = removeByEntryId(queue, command.entryId);
				if (!entry) break;
				if (command.beforeEntryId && isQueueEntryId(command.beforeEntryId)) {
					const before = queue.findIndex((item) => item.entryId === command.beforeEntryId);
					if (before !== -1) {
						queue.splice(before, 0, entry);
						break;
					}
				}
				if (command.afterEntryId && isQueueEntryId(command.afterEntryId)) {
					const after = queue.findIndex((item) => item.entryId === command.afterEntryId);
					if (after !== -1) {
						queue.splice(after + 1, 0, entry);
						break;
					}
				}
				queue.push(entry);
				break;
			}
			case 'clear':
				queue = [];
				break;
			case 'replace':
				queue = command.entries.slice();
				break;
		}
		queue = queue.slice(0, maximumLength);
	}

	return queue;
}
