import { describe, expect, it } from 'vitest';
import { rebaseQueue } from './playback-reconciliation';
import { createQueueEntries } from './queue-entry';
import type { TrackSummary } from '#lib/tidal/models';

const tracks = ['a', 'b', 'c', 'd'].map(
	(id) =>
		({
			kind: 'track',
			id,
			title: id.toUpperCase(),
			artists: [{ id: 'artist', name: 'Artist' }]
		}) as TrackSummary
);

const queue = createQueueEntries(
	tracks,
	(() => {
		let sequence = 0;
		return () => `entry-${++sequence}`;
	})()
);

describe('rebaseQueue', () => {
	it('preserves a remote append and a local append after a stale write', () => {
		const rebased = rebaseQueue([queue[1]!], [{ type: 'append', entries: [queue[0]!] }], 100);
		expect(rebased.map((entry) => entry.id)).toEqual(['b', 'a']);
	});

	it('does not briefly duplicate an append already accepted before a restart', () => {
		const rebased = rebaseQueue(
			[queue[1]!, queue[0]!],
			[{ type: 'append', entries: [queue[0]!] }],
			100
		);

		expect(rebased.map((entry) => entry.entryId)).toEqual(['entry-2', 'entry-1']);
	});

	it('reapplies remove and anchored move commands to the returned queue', () => {
		const rebased = rebaseQueue(
			queue,
			[
				{ type: 'remove', entryId: 'entry-2' },
				{ type: 'move', entryId: 'entry-4', beforeEntryId: 'entry-1' }
			],
			100
		);
		expect(rebased.map((entry) => entry.id)).toEqual(['d', 'a', 'c']);
	});

	it('keeps an explicit clear intentional and enforces the queue bound', () => {
		const rebased = rebaseQueue(
			[queue[0]!, queue[1]!],
			[{ type: 'clear' }, { type: 'append', entries: queue }],
			3
		);
		expect(rebased.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
	});

	it('removes only the requested occurrence when duplicate tracks share a TIDAL ID', () => {
		const [first, second, following] = createQueueEntries(
			[tracks[0]!, tracks[0]!, tracks[1]!],
			(() => {
				let sequence = 0;
				return () => `duplicate-${++sequence}`;
			})()
		);
		const rebased = rebaseQueue(
			[first!, second!, following!],
			[{ type: 'remove', entryId: second!.entryId }],
			100
		);

		expect(rebased.map((entry) => entry.entryId)).toEqual([first!.entryId, following!.entryId]);
	});

	it('moves only the requested occurrence when duplicate tracks share a TIDAL ID', () => {
		const [first, second, following] = createQueueEntries(
			[tracks[0]!, tracks[0]!, tracks[1]!],
			(() => {
				let sequence = 0;
				return () => `move-${++sequence}`;
			})()
		);
		const rebased = rebaseQueue(
			[first!, second!, following!],
			[{ type: 'move', entryId: second!.entryId, beforeEntryId: first!.entryId }],
			100
		);

		expect(rebased.map((entry) => entry.entryId)).toEqual([
			second!.entryId,
			first!.entryId,
			following!.entryId
		]);
	});
});
