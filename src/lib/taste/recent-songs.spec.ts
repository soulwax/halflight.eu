import { describe, expect, it } from 'vitest';
import { weightedRecentSongs } from './recent-songs';
const now = Date.UTC(2026, 9, 8);
const song = { artist: 'Artist', title: 'Song', playedAt: now };
describe('recent songs and fair repeat weights', () => {
	it('deduplicates recordings, retains the latest metadata and sorts newest first', () => {
		const result = weightedRecentSongs(
			[
				{ ...song, recordingId: 'recording', playedAt: now - 1000 },
				{ ...song, recordingId: 'recording', title: 'New title' },
				{ ...song, title: 'Another', playedAt: now - 500 }
			],
			now
		);
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ title: 'New title', repeats: 2, weight: 1.25 });
	});
	it('uses normalized full title and artist when recording IDs are missing', () => {
		expect(
			weightedRecentSongs([song, { ...song, artist: ' ARTIST ', title: ' song ' }], now)
		).toHaveLength(1);
		expect(weightedRecentSongs([song, { ...song, title: 'Song (Live)' }], now)).toHaveLength(2);
	});
	it('bounds repeat influence and splits interest across distinct songs', () => {
		const result = weightedRecentSongs(
			[...Array.from({ length: 100 }, () => song), { ...song, title: 'Another' }],
			now
		);
		expect(result.map((entry) => entry.weight)).toEqual([2, 1]);
	});
	it('halves weight after 90 days and ignores invalid or future observations', () => {
		const result = weightedRecentSongs(
			[
				{ ...song, playedAt: now - 90 * 86_400_000 },
				{ ...song, title: 'Future', playedAt: now + 61_000 },
				{ ...song, playedAt: NaN }
			],
			now
		);
		expect(result).toHaveLength(1);
		expect(result[0].weight).toBeCloseTo(0.5);
	});
});
