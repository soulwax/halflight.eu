import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getUserPlaylists: vi.fn(),
	getConnectionStatus: vi.fn(),
	getCollectionPage: vi.fn(),
	listPrivateMusic: vi.fn(),
	getUnplayableTrackIds: vi.fn()
}));

vi.mock('#lib/server/playlists', () => ({ getUserPlaylists: mocks.getUserPlaylists }));
vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getCollectionPage: mocks.getCollectionPage },
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks),
	getUnplayableTrackIds: mocks.getUnplayableTrackIds
}));
vi.mock('#lib/server/private-music', () => ({
	MAX_PRIVATE_MUSIC_FILE_BYTES: 128 * 1024 * 1024,
	MAX_PRIVATE_MUSIC_TOTAL_BYTES: 512 * 1024 * 1024,
	PRIVATE_MUSIC_FORMATS: [{ label: 'MP3', contentType: 'audio/mpeg', extensions: ['mp3'] }],
	dbPrivateMusicStore: { list: mocks.listPrivateMusic }
}));
vi.mock('#lib/server/private-music-bucket', () => ({ privateMusicBucket: { enabled: true } }));

import { load } from './+page.server';

function event(url: string) {
	return {
		locals: { user: { id: 'owner' }, isAdministrator: true },
		url: new URL(url),
		fetch: vi.fn(),
		cookies: {}
	} as any;
}

describe('/library +page.server', () => {
	beforeEach(() => {
		mocks.getUserPlaylists.mockReset();
		mocks.getConnectionStatus.mockReset();
		mocks.getCollectionPage.mockReset();
		mocks.listPrivateMusic.mockReset();
		mocks.listPrivateMusic.mockResolvedValue([]);
		mocks.getUnplayableTrackIds.mockReset().mockResolvedValue(new Set());
	});

	it('loads private music without querying TIDAL', async () => {
		mocks.listPrivateMusic.mockResolvedValue([
			{
				id: 'local-1',
				fileName: 'night-drive.flac',
				contentType: 'audio/flac',
				sizeBytes: 42,
				createdAt: '2026-01-01T00:00:00.000Z'
			}
		]);

		const result = await load(event('https://m.halflight.eu/library?tab=private'));

		expect(result).toMatchObject({
			tab: 'private',
			status: 'ready',
			privateMusic: {
				storage: { fileCount: 1, usedBytes: 42 },
				files: [{ id: 'local-1', downloadUrl: '/api/private-music/local-1' }]
			}
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});

	it('paginates only the owner saved playlists', async () => {
		mocks.getUserPlaylists.mockResolvedValue(
			Array.from({ length: 13 }, (_, i) => ({
				id: `p${i}`,
				title: `Playlist ${i}`,
				items: []
			}))
		);

		const result = await load(event('https://m.halflight.eu/library?tab=saved&page=2'));
		expect(result).toMatchObject({
			tab: 'saved',
			status: 'ready',
			playlists: [{ id: 'p12' }],
			previousQuery: 'tab=saved&page=1',
			nextQuery: null
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});
	it('keeps saved playlists independent of the private upload store', async () => {
		mocks.listPrivateMusic.mockRejectedValue(new Error('storage offline'));
		mocks.getUserPlaylists.mockResolvedValue([{ id: 'saved', title: 'Saved', items: [] }]);
		expect(await load(event('https://m.halflight.eu/library?tab=saved'))).toMatchObject({
			status: 'ready',
			playlists: [{ id: 'saved' }]
		});
		expect(mocks.listPrivateMusic).not.toHaveBeenCalled();
	});
	it('returns a retryable private-library failure without querying TIDAL', async () => {
		mocks.listPrivateMusic.mockRejectedValue(new Error('storage offline'));
		expect(await load(event('https://m.halflight.eu/library?tab=private'))).toMatchObject({
			status: 'unavailable'
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});

	it('normalises a favorites page and retains only its opaque pagination cursor', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getCollectionPage.mockResolvedValue({
			data: [{ id: 't1', type: 'tracks', attributes: { title: 'Remote track' } }],
			included: [],
			links: {
				next: 'https://openapi.tidal.com/v2/page?page%5Bcursor%5D=opaque-token&unexpected=drop'
			}
		});

		const result = await load(event('https://m.halflight.eu/library?tab=tracks'));
		expect(result).toMatchObject({
			tab: 'tracks',
			status: 'ready',
			tracks: [expect.objectContaining({ id: 't1' })],
			nextQuery: 'tab=tracks&cursor=opaque-token'
		});
		expect(mocks.getCollectionPage).toHaveBeenCalledWith(
			'tracks',
			expect.objectContaining({ cursor: undefined }),
			expect.any(Object)
		);
	});

	it('does not query TIDAL when favorites are disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });

		const result = await load(event('https://m.halflight.eu/library?tab=tracks'));
		expect(result).toMatchObject({ tab: 'tracks', status: 'disconnected', tracks: [] });
		expect(mocks.getCollectionPage).not.toHaveBeenCalled();
	});
	it('searches all saved playlists before pagination and retains the query in page links', async () => {
		mocks.getUserPlaylists.mockResolvedValue([
			{ id: 'other', title: 'Other', items: [] },
			...Array.from({ length: 13 }, (_, i) => ({
				id: `match-${i}`,
				title: 'Night Drive',
				items: []
			}))
		]);
		const result = await load(event('https://m.halflight.eu/library?tab=saved&q=night&page=2'));
		expect(result).toMatchObject({
			query: 'night',
			playlists: [{ id: 'match-12' }],
			previousQuery: 'tab=saved&page=1&q=night'
		});
		expect(mocks.getCollectionPage).not.toHaveBeenCalled();
	});
	it('matches saved track artists and keeps owner track counts when broken entries are skipped', async () => {
		const items = [
			{ id: 'bad', title: 'One', artists: [{ name: 'Björk' }] },
			{ id: 'good', title: 'Two', artists: [] }
		];
		mocks.getUserPlaylists.mockResolvedValue([{ id: 'p1', title: 'My playlist', items }]);
		mocks.getUnplayableTrackIds.mockResolvedValue(new Set(['bad']));
		const result = await load(event('https://m.halflight.eu/library?q=BJ%C3%96RK'));
		expect(result).toMatchObject({
			playlists: [{ totalTrackCount: 2, items: [{ id: 'good' }] }],
			hiddenTrackCount: 1
		});
		expect(items).toHaveLength(2);
	});
});
