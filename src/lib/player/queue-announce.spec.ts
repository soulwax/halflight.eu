import { describe, expect, it } from 'vitest';
import { describeQueueMove } from './queue-announce.js';
import { createQueueEntry } from './queue-entry.js';
import type { TrackSummary } from '#lib/tidal/models';

const track = (id: string, title: string): TrackSummary => ({
	kind: 'track',
	id,
	title,
	artists: [{ id: 'a', name: 'A' }]
});

describe('describeQueueMove', () => {
	it('reports a one-based position and the queue length', () => {
		const queue = [
			createQueueEntry(track('1', 'One')),
			createQueueEntry(track('2', 'Two')),
			createQueueEntry(track('3', 'Three'))
		];

		expect(describeQueueMove(queue, queue[1].entryId)).toEqual({
			title: 'Two',
			position: 2,
			total: 3
		});
	});

	it('distinguishes duplicate recordings by entry, not by track id', () => {
		const first = createQueueEntry(track('1', 'One'));
		const second = createQueueEntry(track('1', 'One'));
		const queue = [first, second];

		expect(describeQueueMove(queue, second.entryId)?.position).toBe(2);
		expect(describeQueueMove(queue, first.entryId)?.position).toBe(1);
	});

	it('stays silent when the entry has gone', () => {
		expect(describeQueueMove([], 'missing')).toBeNull();
	});
});
