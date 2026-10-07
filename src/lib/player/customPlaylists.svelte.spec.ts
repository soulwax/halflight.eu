import { afterEach, describe, expect, it, vi } from 'vitest';
import { customPlaylists } from './customPlaylists.svelte';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	customPlaylists.playlists = [];
});
describe('playlist refresh direction', () => {
	it('pulls an unchanged TIDAL import instead of publishing its filtered local copy', async () => {
		customPlaylists.playlists = [
			{
				id: 'local',
				title: 'Imported',
				items: [],
				createdAt: '',
				updatedAt: '',
				source: 'tidal',
				tidalPlaylistId: 'remote',
				syncStatus: 'synced'
			}
		];
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'synced' }));
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(customPlaylists, 'syncWithServer').mockResolvedValue(undefined);
		expect(await customPlaylists.syncPlaylist('local')).toBe(true);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			action: 'pull',
			tidalPlaylistId: 'remote'
		});
	});
	it('does not report an HTTP 200 application failure as a successful sync', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(Response.json({ status: 'error', streamValidation: 'deferred' }))
		);
		vi.spyOn(customPlaylists, 'syncWithServer').mockResolvedValue(undefined);
		expect(await customPlaylists.syncPlaylist('local')).toBe(false);
	});
});
