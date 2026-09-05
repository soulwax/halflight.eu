import type { TrackSummary } from '#lib/tidal/models.js';

/**
 * Queue edits made after the last accepted playback-state revision. They are
 * deliberately expressed as commands rather than another full snapshot so a
 * 409 response can be rebased on the server queue without replacing it.
 *
 * Track ids are the only stable queue identity in the current protocol. The
 * first matching item is therefore targeted; a future entry-id protocol can
 * refine that behaviour without changing the persistence flow.
 */
export type QueueCommand =
	| { type: 'append'; tracks: TrackSummary[] }
	| { type: 'prepend'; track: TrackSummary }
	| { type: 'remove'; trackId: string }
	| { type: 'move'; trackId: string; beforeTrackId?: string; afterTrackId?: string }
	| { type: 'clear' }
	| { type: 'replace'; tracks: TrackSummary[] };

function removeFirstById(queue: TrackSummary[], trackId: string): TrackSummary | null {
	const index = queue.findIndex((track) => track.id === trackId);
	return index === -1 ? null : (queue.splice(index, 1)[0] ?? null);
}

/** Reapply deliberate local queue commands to an authoritative remote queue. */
export function rebaseQueue(
	remoteQueue: TrackSummary[],
	commands: readonly QueueCommand[],
	maximumLength: number
): TrackSummary[] {
	let queue = remoteQueue.slice(0, maximumLength);

	for (const command of commands) {
		switch (command.type) {
			case 'append':
				queue.push(...command.tracks);
				break;
			case 'prepend':
				queue.unshift(command.track);
				break;
			case 'remove':
				removeFirstById(queue, command.trackId);
				break;
			case 'move': {
				const track = removeFirstById(queue, command.trackId);
				if (!track) break;
				if (command.beforeTrackId) {
					const before = queue.findIndex((item) => item.id === command.beforeTrackId);
					if (before !== -1) {
						queue.splice(before, 0, track);
						break;
					}
				}
				if (command.afterTrackId) {
					const after = queue.findIndex((item) => item.id === command.afterTrackId);
					if (after !== -1) {
						queue.splice(after + 1, 0, track);
						break;
					}
				}
				queue.push(track);
				break;
			}
			case 'clear':
				queue = [];
				break;
			case 'replace':
				queue = command.tracks.slice();
				break;
		}
		queue = queue.slice(0, maximumLength);
	}

	return queue;
}
