import { describe, expect, it } from 'vitest';
import { reconcilePlaylistsWithServer, type CustomPlaylist } from './customPlaylists.svelte';

function playlist(id: string, updatedAt: string): CustomPlaylist {
	return {
		id,
		title: id,
		createdAt: updatedAt,
		updatedAt,
		items: []
	};
}

describe('reconcilePlaylistsWithServer', () => {
	it('drops a stale browser playlist deleted from Postgres and orders the remaining snapshot', () => {
		const cachedPlaylists = [
			playlist('deleted-on-another-device', '2026-09-03T00:00:00.000Z'),
			playlist('older', '2026-09-01T00:00:00.000Z')
		];
		const serverPlaylists = [
			playlist('older', '2026-09-01T00:00:00.000Z'),
			playlist('newer', '2026-09-02T00:00:00.000Z')
		];

		const result = reconcilePlaylistsWithServer(cachedPlaylists, serverPlaylists);

		expect(result.map(({ id }) => id)).toEqual(['newer', 'older']);
		expect(result).not.toBe(serverPlaylists);
	});
});
