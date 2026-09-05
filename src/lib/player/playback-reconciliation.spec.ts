import { describe, expect, it } from 'vitest';
import { rebaseQueue } from './playback-reconciliation';
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

describe('rebaseQueue', () => {
	it('preserves a remote append and a local append after a stale write', () => {
		const queue = rebaseQueue([tracks[1]], [{ type: 'append', tracks: [tracks[0]] }], 100);
		expect(queue.map((track) => track.id)).toEqual(['b', 'a']);
	});

	it('reapplies remove and anchored move commands to the returned queue', () => {
		const queue = rebaseQueue(
			[tracks[0], tracks[1], tracks[2], tracks[3]],
			[
				{ type: 'remove', trackId: 'b' },
				{ type: 'move', trackId: 'd', beforeTrackId: 'a' }
			],
			100
		);
		expect(queue.map((track) => track.id)).toEqual(['d', 'a', 'c']);
	});

	it('keeps an explicit clear intentional and enforces the queue bound', () => {
		const queue = rebaseQueue(
			[tracks[0], tracks[1]],
			[{ type: 'clear' }, { type: 'append', tracks }],
			3
		);
		expect(queue.map((track) => track.id)).toEqual(['a', 'b', 'c']);
	});
});
