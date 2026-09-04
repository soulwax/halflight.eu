import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		search: vi.fn(),
		createUserPlaylist: vi.fn(),
		attemptTidalPlaylistSync: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { search: mocks.search }
}));

vi.mock('#lib/server/playlists', () => ({
	createUserPlaylist: mocks.createUserPlaylist,
	attemptTidalPlaylistSync: mocks.attemptTidalPlaylistSync
}));

import type { Cookies } from '@sveltejs/kit';
import { POST } from './+server';

const fetchMock = vi.fn();

function makeEvent(body: Record<string, unknown> = {}, user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		request: {
			json: vi.fn().mockResolvedValue(body)
		},
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/generate-playlist', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.search.mockReset();
		mocks.createUserPlaylist.mockReset();
		mocks.attemptTidalPlaylistSync.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(POST(makeEvent({}, null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns 503 if TIDAL is not connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });
		const res = await POST(makeEvent({ vibe: 'kinetic', era: 'contemporary' }));
		expect(res.status).toBe(503);
		const data = await res.json();
		expect(data).toEqual({ error: 'not_connected' });
	});

	it('generates a playlist with tracks and saves directly to account', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.search.mockResolvedValue({
			data: [
				{
					id: 'track-gen-1',
					type: 'tracks',
					attributes: {
						title: 'Generated Synth Track',
						duration: 210,
						cover: 'https://resources.tidal.com/images/example/640x640.jpg',
						artistName: 'Synth Master'
					},
					relationships: {}
				}
			],
			included: []
		});
		mocks.attemptTidalPlaylistSync.mockResolvedValue('tidal-uuid-123');
		mocks.createUserPlaylist.mockResolvedValue({
			id: 'pl_123',
			userId: 'u1',
			title: 'HALFLIGHT // KINETIC SYNTH & CLUB [CONTEMPORARY 2020s]',
			description: 'Test Description',
			items: [],
			tidalPlaylistId: 'tidal-uuid-123',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		const res = await POST(
			makeEvent({
				vibe: 'kinetic',
				era: 'contemporary',
				texture: 'synthesizers',
				energyArc: 'steady',
				size: 12
			})
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.title).toContain('KINETIC SYNTH & CLUB');
		expect(data.savedToAccount).toBe(true);
		expect(data.tidalPlaylistId).toBe('tidal-uuid-123');
		expect(data.tracks).toHaveLength(1);
		expect(data.tracks[0].title).toBe('Generated Synth Track');
		expect(data.tracks[0].artists[0].name).toBe('Synth Master');
		expect(mocks.createUserPlaylist).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'u1',
				tidalPlaylistId: 'tidal-uuid-123'
			})
		);
	});
});
