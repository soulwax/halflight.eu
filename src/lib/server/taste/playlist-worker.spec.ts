import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getPlaylistItems: vi.fn(), getFullCollection: vi.fn() }));
vi.mock('#lib/server/db', () => ({ db: {} }));
vi.mock('#lib/server/listening-preferences', () => ({ getListeningPreferences: vi.fn() }));
vi.mock('#lib/server/tidal', () => ({
	tidalApi: { getPlaylistItems: mocks.getPlaylistItems, getFullCollection: mocks.getFullCollection }
}));
vi.mock('#lib/server/tidal/store', () => ({ createDbTokenRowStore: () => ({}) }));

import { TidalApiError, TidalAuthError } from '#lib/server/tidal/errors';
import {
	FIRST_PASS_SPACING_MS,
	MAX_ITEMS_PER_PLAYLIST,
	MAX_PLAYLIST_FAILURES,
	REFRESH_SPACING_MS,
	RELIST_INTERVAL_MS,
	emptyAnalysisState
} from './playlist-analysis';
import {
	backoffFor,
	runAnalysisStep,
	tidalPlaylistSource,
	type PlaylistAnalysisSource
} from './playlist-worker';

const now = new Date('2026-10-08T00:00:00Z');

function source(playlists: Record<string, string[]>): PlaylistAnalysisSource {
	return {
		listPlaylists: vi.fn(async () => Object.keys(playlists).map((id) => ({ id, version: 'v1' }))),
		readItems: vi.fn(async (id: string) => playlists[id].map((artist) => ({ artistIds: [artist] })))
	};
}

describe('playlist analysis steps', () => {
	it('works through a first pass one playlist at a time, slowly, then rebuilds once', async () => {
		const tidal = source({ p1: ['a'], p2: ['b'] });
		let step = await runAnalysisStep(emptyAnalysisState(), tidal, now);
		expect(step).toMatchObject({ delayMs: FIRST_PASS_SPACING_MS, rebuild: false });
		expect(step.state.pending).toEqual(['p1', 'p2']);
		expect(tidal.readItems).not.toHaveBeenCalled();

		step = await runAnalysisStep(step.state, tidal, now);
		expect(tidal.readItems).toHaveBeenCalledTimes(1);
		expect(step).toMatchObject({ delayMs: FIRST_PASS_SPACING_MS, rebuild: false });

		step = await runAnalysisStep(step.state, tidal, now);
		expect(step).toMatchObject({ delayMs: RELIST_INTERVAL_MS, rebuild: true });
		expect(step.state.firstPassCompletedAt).toBe(now.toISOString());
		expect(Object.keys(step.state.playlists)).toEqual(['p1', 'p2']);
	});

	it('re-analyses only what changed afterwards, at the quicker pace', async () => {
		const tidal = source({ p1: ['a'], p2: ['b'] });
		let state = emptyAnalysisState();
		for (let i = 0; i < 3; i++) state = (await runAnalysisStep(state, tidal, now)).state;
		const later = new Date(now.getTime() + RELIST_INTERVAL_MS);
		vi.mocked(tidal.listPlaylists).mockResolvedValue([
			{ id: 'p1', version: 'v1' },
			{ id: 'p2', version: 'v2' }
		]);
		const step = await runAnalysisStep(state, tidal, later);
		expect(step.state.pending).toEqual(['p2']);
		expect(step.delayMs).toBe(REFRESH_SPACING_MS);
	});

	it('does no playlist work when nothing changed', async () => {
		const tidal = source({ p1: ['a'] });
		let state = emptyAnalysisState();
		for (let i = 0; i < 2; i++) state = (await runAnalysisStep(state, tidal, now)).state;
		vi.mocked(tidal.readItems).mockClear();
		const step = await runAnalysisStep(state, tidal, new Date(now.getTime() + RELIST_INTERVAL_MS));
		expect(step).toMatchObject({ rebuild: false, delayMs: RELIST_INTERVAL_MS });
		expect(tidal.readItems).not.toHaveBeenCalled();
	});

	it('retries a failing playlist later in the pass and gives up after a few attempts', async () => {
		const tidal = source({ bad: ['a'], good: ['b'] });
		vi.mocked(tidal.readItems).mockImplementation(async (id) => {
			if (id === 'bad') throw new Error('malformed');
			return [{ artistIds: ['b'] }];
		});
		let state = (await runAnalysisStep(emptyAnalysisState(), tidal, now)).state;
		state = (await runAnalysisStep(state, tidal, now)).state;
		expect(state.pending).toEqual(['good', 'bad']);
		for (let i = 0; i < MAX_PLAYLIST_FAILURES; i++)
			state = (await runAnalysisStep(state, tidal, now)).state;
		expect(state.pending).toEqual([]);
		expect(state.failures.bad).toBe(MAX_PLAYLIST_FAILURES);
		expect(state.firstPassCompletedAt).not.toBeNull();
	});

	it('defers the whole account when TIDAL says "not now"', async () => {
		const tidal = source({ p1: ['a'] });
		const state = (await runAnalysisStep(emptyAnalysisState(), tidal, now)).state;
		vi.mocked(tidal.readItems).mockRejectedValue(new TidalApiError(429, 'Too Many', null, '/'));
		await expect(runAnalysisStep(state, tidal, now)).rejects.toBeInstanceOf(TidalApiError);
		expect(backoffFor(new TidalApiError(429, '', null, '/'))).toBe(15 * 60_000);
		expect(backoffFor(new TidalAuthError())).toBe(12 * 60 * 60_000);
	});
});

describe('TIDAL playlist source', () => {
	it('reads artists, release dates and added dates, capped per playlist', async () => {
		const page = (start: number, next?: string) => ({
			data: Array.from({ length: 100 }, (_, i) => ({
				id: String(start + i),
				type: 'tracks',
				meta: { addedAt: '2026-01-01T00:00:00Z' }
			})),
			included: Array.from({ length: 100 }, (_, i) => ({
				id: String(start + i),
				type: 'tracks',
				relationships: {
					artists: { data: [{ id: 'artist', type: 'artists' }] },
					albums: { data: [{ id: 'album', type: 'albums' }] }
				}
			})).concat([
				{ id: 'album', type: 'albums', attributes: { releaseDate: '1999-02-03' } } as never
			]),
			links: next ? { next } : {}
		});
		mocks.getPlaylistItems.mockImplementation(async (_id: string, opts: { cursor?: string }) => {
			const index = Number(opts.cursor ?? 0);
			return page(index * 100, `/playlists/p/relationships/items?page[cursor]=${index + 1}`);
		});
		const facts = await tidalPlaylistSource('u').readItems('p');
		expect(facts).toHaveLength(MAX_ITEMS_PER_PLAYLIST);
		expect(mocks.getPlaylistItems).toHaveBeenCalledTimes(MAX_ITEMS_PER_PLAYLIST / 100);
		expect(facts[0]).toEqual({
			artistIds: ['artist'],
			releaseDate: '1999-02-03',
			addedAt: '2026-01-01T00:00:00Z'
		});
	});

	it('versions playlists by modification time and size', async () => {
		mocks.getFullCollection.mockResolvedValue({
			items: [{ id: 'p', type: 'playlists' }],
			included: [
				{
					id: 'p',
					type: 'playlists',
					attributes: { lastModifiedAt: '2026-10-01T00:00:00Z', numberOfItems: 12 }
				}
			]
		});
		expect(await tidalPlaylistSource('u').listPlaylists()).toEqual([
			{ id: 'p', version: '2026-10-01T00:00:00Z|12' }
		]);
	});
});
