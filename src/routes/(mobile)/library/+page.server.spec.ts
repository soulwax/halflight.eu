import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getUserPlaylists: vi.fn(),
	getConnectionStatus: vi.fn(),
	getCollectionPage: vi.fn()
}));

vi.mock('#lib/server/playlists', () => ({ getUserPlaylists: mocks.getUserPlaylists }));
vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getCollectionPage: mocks.getCollectionPage }
}));

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
});
