import { describe, expect, it } from 'vitest';
import {
	FIRST_PASS_SPACING_MS,
	MAX_PLAYLIST_FAILURES,
	REFRESH_SPACING_MS,
	aggregateDigests,
	applyListing,
	digestPlaylist,
	emptyAnalysisState,
	isListingDue,
	stepSpacing,
	type PlaylistDigest
} from './playlist-analysis';

const now = new Date('2026-10-08T00:00:00Z');
const old = '2020-01-01T00:00:00Z';

describe('playlist digest', () => {
	it('saturates an artist instead of letting one playlist-sized artist dominate', () => {
		const one = digestPlaylist([{ artistIds: ['a'], addedAt: old }], 'v', now);
		const ten = digestPlaylist(
			Array.from({ length: 10 }, () => ({ artistIds: ['a'], addedAt: old })),
			'v',
			now
		);
		expect(one.artists.a).toBeCloseTo(0.28, 2);
		expect(ten.artists.a).toBeGreaterThan(0.95);
		expect(ten.artists.a).toBeLessThanOrEqual(1);
	});

	it('counts featured artists half and recent additions more', () => {
		const digest = digestPlaylist(
			[
				{ artistIds: ['lead', 'feature'], addedAt: old },
				{ artistIds: ['fresh'], addedAt: now.toISOString() }
			],
			'v',
			now
		);
		expect(digest.artists.feature).toBeLessThan(digest.artists.lead);
		expect(digest.artists.fresh).toBeGreaterThan(digest.artists.lead);
	});

	it('records the share of each decade among dated songs', () => {
		const digest = digestPlaylist(
			[
				{ artistIds: ['a'], releaseDate: '1984-01-01' },
				{ artistIds: ['b'], releaseDate: '1989-05-05' },
				{ artistIds: ['c'], releaseDate: '2001-01-01' },
				{ artistIds: ['d'] }
			],
			'v',
			now
		);
		expect(digest.eras).toEqual({ '1980': 0.6667, '2000': 0.3333 });
		expect(digest.items).toBe(4);
	});
});

describe('aggregating playlists', () => {
	const digest = (artists: Record<string, number>, items = 50): PlaylistDigest => ({
		version: 'v',
		analyzedAt: now.toISOString(),
		items,
		artists,
		eras: {}
	});

	it('lets an artist found across many playlists outrank a one-playlist favourite', () => {
		const { artists, playlistCount } = aggregateDigests({
			p1: digest({ everywhere: 0.5, once: 0.9 }),
			p2: digest({ everywhere: 0.5 }),
			p3: digest({ everywhere: 0.5 })
		});
		expect(artists.everywhere).toBe(1);
		expect(artists.once).toBeLessThan(1);
		expect(playlistCount).toBe(3);
	});

	it('gives larger playlists more weight with diminishing returns', () => {
		const { artists } = aggregateDigests({
			small: digest({ small: 1 }, 5),
			large: digest({ large: 1 }, 5000)
		});
		expect(artists.large).toBe(1);
		expect(artists.small).toBeGreaterThanOrEqual(0.2);
		expect(artists.small).toBeLessThan(0.5);
	});
});

describe('playlist listing', () => {
	it('queues new and changed playlists and forgets removed ones', () => {
		const state = {
			...emptyAnalysisState(),
			known: { same: 'v1', changed: 'v1', removed: 'v1' },
			playlists: {
				same: { version: 'v1', analyzedAt: '', items: 1, artists: {}, eras: {} },
				changed: { version: 'v1', analyzedAt: '', items: 1, artists: {}, eras: {} },
				removed: { version: 'v1', analyzedAt: '', items: 1, artists: {}, eras: {} }
			}
		};
		const next = applyListing(
			state,
			[
				{ id: 'same', version: 'v1' },
				{ id: 'changed', version: 'v2' },
				{ id: 'new', version: 'v1' }
			],
			now
		);
		expect(next.pending).toEqual(['changed', 'new']);
		expect(Object.keys(next.playlists)).toEqual(['same', 'changed']);
		expect(next.listedAt).toBe(now.toISOString());
	});

	it('skips a playlist that kept failing until it changes', () => {
		const state = {
			...emptyAnalysisState(),
			known: { broken: 'v1' },
			failures: { broken: MAX_PLAYLIST_FAILURES }
		};
		expect(applyListing(state, [{ id: 'broken', version: 'v1' }], now).pending).toEqual([]);
		expect(applyListing(state, [{ id: 'broken', version: 'v2' }], now).pending).toEqual(['broken']);
	});

	it('re-lists daily once nothing is pending', () => {
		const listed = { ...emptyAnalysisState(), listedAt: '2026-10-07T12:00:00Z' };
		expect(isListingDue(emptyAnalysisState(), now)).toBe(true);
		expect(isListingDue(listed, now)).toBe(false);
		expect(isListingDue({ ...listed, listedAt: '2026-10-06T00:00:00Z' }, now)).toBe(true);
		expect(isListingDue({ ...listed, listedAt: old, pending: ['x'] }, now)).toBe(false);
	});

	it('is slow on the first pass and quicker afterwards', () => {
		expect(stepSpacing(emptyAnalysisState())).toBe(FIRST_PASS_SPACING_MS);
		expect(stepSpacing({ ...emptyAnalysisState(), firstPassCompletedAt: old })).toBe(
			REFRESH_SPACING_MS
		);
	});
});
