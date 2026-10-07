import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	track: vi.fn(),
	find: vi.fn(),
	validate: vi.fn(),
	replace: vi.fn()
}));
vi.mock('#lib/server/playlists', () => ({ getUserPlaylists: mocks.list }));
vi.mock('#lib/server/tidal/api', () => ({ getTrack: mocks.track, search: vi.fn() }));
vi.mock('#lib/server/playback-state', () => ({ dbPlaybackStateStore: { read: async () => null } }));
vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: async () => ({ preferredQuality: 'HIGH' })
}));
vi.mock('#lib/server/playlists/recording-verification', async (original) => ({
	...(await original<object>()),
	findVerifiedReplacements: mocks.find
}));
vi.mock('#lib/server/playlists/playback-validation', () => ({
	validatePlaylistPlayback: mocks.validate
}));
vi.mock('#lib/server/playlists/replace-recording', () => ({
	replaceSavedRecording: mocks.replace
}));
import { GET, POST } from './+server';
const original = {
	kind: 'track',
	id: '1',
	title: 'Song',
	artists: [{ id: 'a', name: 'Artist' }],
	isrc: 'GBABC2300001'
};
const replacement = { ...original, id: '2' };
function event(body: unknown = {}, listener = true) {
	return {
		locals: { user: { id: 'owner' }, isListener: listener },
		params: { id: '1' },
		request: new Request('http://localhost/api/tracks/1/replacements', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		fetch,
		cookies: {}
	} as unknown as Parameters<typeof GET>[0];
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.list.mockResolvedValue([
		{ id: 'playlist', title: 'Saved', updatedAt: 'version', items: [original] }
	]);
	mocks.track.mockImplementation(async (id) => ({
		data: { id, type: 'tracks', attributes: { ...(id === '1' ? original : replacement) } }
	}));
	mocks.find.mockResolvedValue([{ track: replacement, match: 'isrc' }]);
	mocks.validate.mockResolvedValue([replacement]);
	mocks.replace.mockResolvedValue('updated');
});
describe('interactive recording replacement', () => {
	it('requires a signed-in listener for suggestions and updates', async () => {
		await expect(GET(event({}, false))).rejects.toMatchObject({ status: 401 });
		await expect(POST(event({}, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.replace).not.toHaveBeenCalled();
	});
	it('returns verified suggestions and only the owner’s affected playlists', async () => {
		const response = await GET(event());
		expect(await response.json()).toMatchObject({
			candidates: [{ match: 'isrc' }],
			playlists: [{ id: 'playlist', version: 'version' }]
		});
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(mocks.list).toHaveBeenCalledWith('owner');
	});
	it('rechecks playback and updates the selected local playlist on acceptance', async () => {
		const response = await POST(
			event({ candidateId: '2', playlistId: 'playlist', version: 'version' })
		);
		expect(await response.json()).toMatchObject({ track: { id: '2' }, playlistUpdated: true });
		expect(mocks.replace).toHaveBeenCalledWith(
			'owner',
			'playlist',
			'1',
			expect.objectContaining({ id: '2' }),
			'version'
		);
		expect(mocks.validate.mock.calls[0][4]).toBe(true);
	});
	it('allows playback without changing a playlist', async () => {
		await POST(event({ candidateId: '2', playlistId: null }));
		expect(mocks.replace).not.toHaveBeenCalled();
	});
	it('rejects stale playlist edits and candidates that stopped playing', async () => {
		mocks.replace.mockResolvedValue('conflict');
		await expect(
			POST(event({ candidateId: '2', playlistId: 'playlist', version: 'old' }))
		).rejects.toMatchObject({ status: 409 });
		mocks.replace.mockClear();
		mocks.validate.mockResolvedValue([]);
		await expect(
			POST(event({ candidateId: '2', playlistId: 'playlist', version: 'version' }))
		).rejects.toMatchObject({ status: 409 });
		expect(mocks.replace).not.toHaveBeenCalled();
	});
});
