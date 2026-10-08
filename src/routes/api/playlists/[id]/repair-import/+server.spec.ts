import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	full: vi.fn(),
	track: vi.fn(),
	validate: vi.fn(),
	find: vi.fn(),
	set: vi.fn(),
	returned: vi.fn()
}));
vi.mock('#lib/server/playlists', () => ({ getUserPlaylists: mocks.list }));
vi.mock('#lib/server/tidal/api', () => ({
	getFullPlaylist: mocks.full,
	getTrack: mocks.track,
	search: vi.fn()
}));
vi.mock('#lib/server/tidal/normalise', () => ({
	normalisePlaylistDetail: (value: unknown) => value,
	normaliseTrackDetail: (value: unknown) => value,
	normaliseSearchResults: () => ({ tracks: [] })
}));
vi.mock('#lib/server/playlists/sync', () => ({ playlistSourceVersion: () => 'source-version' }));
vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: async () => ({ preferredQuality: 'HIGH' })
}));
vi.mock('#lib/server/playlists/recording-verification', () => ({
	findVerifiedReplacements: mocks.find
}));
vi.mock('#lib/server/playlists/playback-validation', () => ({
	validatePlaylistPlayback: mocks.validate
}));
vi.mock('#lib/server/db', () => ({ db: { update: () => ({ set: mocks.set }) } }));
import { GET, POST } from './+server';
const song = (id: string) => ({ kind: 'track' as const, id, title: `Song ${id}`, artists: [] });
const version = '2026-10-08T12:00:00.000Z';
function event(body: unknown = {}, listener = true) {
	return {
		locals: { user: { id: 'owner' }, isListener: listener },
		params: { id: 'playlist' },
		url: new URL('http://localhost/api/playlists/playlist/repair-import?sourceId=2'),
		request: new Request('http://localhost/api/playlists/playlist/repair-import', {
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
		{
			id: 'playlist',
			tidalPlaylistId: 'remote',
			syncStatus: 'synced',
			remoteEtag: 'source-version',
			updatedAt: version,
			items: [song('1'), song('3')]
		}
	]);
	mocks.full.mockResolvedValue({ items: [song('1'), song('2'), song('3'), song('2')] });
	mocks.track.mockResolvedValue(song('22'));
	mocks.validate.mockResolvedValue([song('22')]);
	mocks.find.mockResolvedValue([{ track: song('22') }]);
	mocks.returned.mockResolvedValue([{ id: 'playlist' }]);
	mocks.set.mockReturnValue({ where: () => ({ returning: mocks.returned }) });
});
describe('interactive import repair', () => {
	it('requires the signed-in owner and never writes to a missing owned playlist', async () => {
		await expect(GET(event({}, false))).rejects.toMatchObject({ status: 401 });
		mocks.list.mockResolvedValue([]);
		await expect(GET(event())).rejects.toMatchObject({ status: 404 });
		expect(mocks.set).not.toHaveBeenCalled();
	});
	it('returns suggestions and the current edit version', async () => {
		expect(await (await GET(event())).json()).toMatchObject({
			source: { id: '2' },
			candidates: [{ id: '22' }],
			version
		});
		expect(mocks.list).toHaveBeenCalledWith('owner');
	});
	it('restores missing occurrences in source order and verifies playback before committing', async () => {
		expect(
			await (await POST(event({ sourceId: '2', candidateId: '22', version }))).json()
		).toMatchObject({ saved: true });
		const items = JSON.parse(mocks.set.mock.calls[0][0].itemsJson);
		expect(items.map((item: { id: string }) => item.id)).toEqual(['1', '22', '3', '22']);
		expect(items[1].replacementForId).toBe('2');
		expect(mocks.validate).toHaveBeenCalledWith(
			[song('22')],
			'owner',
			expect.anything(),
			'HIGH',
			true
		);
	});
	it('preserves the playlist when the version changed or the chosen recording cannot play', async () => {
		await expect(
			POST(event({ sourceId: '2', candidateId: '22', version: 'old' }))
		).rejects.toMatchObject({ status: 409 });
		mocks.validate.mockResolvedValue([]);
		await expect(POST(event({ sourceId: '2', candidateId: '22', version }))).rejects.toMatchObject({
			status: 409
		});
		expect(mocks.set).not.toHaveBeenCalled();
	});
	it('reports a concurrent edit instead of claiming the repair was saved', async () => {
		mocks.returned.mockResolvedValue([]);
		await expect(POST(event({ sourceId: '2', candidateId: '22', version }))).rejects.toMatchObject({
			status: 409
		});
	});
});
