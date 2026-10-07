import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ files: vi.fn(), playlists: vi.fn() }));
vi.mock('#lib/server/private-music', () => ({
	dbPrivateMusicStore: { list: mocks.files },
	MAX_PRIVATE_MUSIC_FILE_BYTES: 128 * 1024 ** 2,
	MAX_PRIVATE_MUSIC_TOTAL_BYTES: 512 * 1024 ** 2,
	PRIVATE_MUSIC_FORMATS: []
}));
vi.mock('#lib/server/private-music-bucket', () => ({ privateMusicBucket: { enabled: false } }));
vi.mock('#lib/server/playlists', () => ({ getUserPlaylists: mocks.playlists }));
vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: async () => ({ connected: false }),
	filterPlayableTracks: async (tracks: unknown[]) => tracks,
	tidalApi: {}
}));
import { load } from './+page.server';
const event = { locals: { user: { id: 'listener' }, isListener: true } } as never;
beforeEach(() => {
	mocks.files.mockReset().mockResolvedValue([]);
	mocks.playlists.mockReset().mockResolvedValue([{ id: 'saved', items: [] }]);
});
describe('desktop library storage boundaries', () => {
	it('renders owned playlists even if private audio storage fails', async () => {
		mocks.files.mockRejectedValue(new Error('Storage unavailable'));
		const data = await load(event);
		expect(data).toMatchObject({
			savedPlaylists: [{ id: 'saved' }],
			savedUnavailable: false,
			privateMusicUnavailable: true
		});
		expect(mocks.playlists).toHaveBeenCalledWith('listener');
	});
	it('reports a failed playlist read rather than a genuinely empty library', async () => {
		mocks.playlists.mockRejectedValue(new Error('Storage unavailable'));
		expect(await load(event)).toMatchObject({
			savedUnavailable: true,
			privateMusicUnavailable: false
		});
	});
});
