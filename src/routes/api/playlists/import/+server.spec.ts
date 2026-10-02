import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		listImportablePlaylists: vi.fn(),
		pullPlaylist: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus
}));

vi.mock('#lib/server/playlists/sync', () => ({
	listImportablePlaylists: mocks.listImportablePlaylists,
	pullPlaylist: mocks.pullPlaylist
}));

import type { Cookies } from '@sveltejs/kit';
import { GET, POST } from './+server';

const fetchMock = vi.fn();

function makeEvent(
	body: unknown = {},
	user: { id: string } | null = { id: 'u1' },
	isAdministrator = true,
	jsonError?: unknown
) {
	return {
		locals: { user, isAdministrator },
		request: {
			json:
				jsonError === undefined
					? vi.fn().mockResolvedValue(body)
					: vi.fn().mockRejectedValue(jsonError)
		},
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('API /api/playlists/import', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.listImportablePlaylists.mockReset();
		mocks.pullPlaylist.mockReset();
		fetchMock.mockReset();
	});

	describe('GET /api/playlists/import', () => {
		it('rejects unauthenticated requests with 401', async () => {
			await expect(GET(makeEvent({}, null))).rejects.toMatchObject({
				status: 401
			});
		});

		it('rejects a signed-in non-owner request with 401', async () => {
			await expect(GET(makeEvent({}, { id: 'other-user' }, false))).rejects.toMatchObject({
				status: 401
			});
		});

		it('returns 503 if TIDAL is not connected', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: false });
			const res = await GET(makeEvent());
			expect(res.status).toBe(503);
			const json = await res.json();
			expect(json.error).toBe('not_connected');
		});

		it('returns list of importable playlists when connected', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			mocks.listImportablePlaylists.mockResolvedValue({
				playlists: [{ id: 'pl-1', title: 'Roadtrip', isImported: false }],
				error: null
			});

			const res = await GET(makeEvent());
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.playlists).toHaveLength(1);
			expect(json.playlists[0].title).toBe('Roadtrip');
		});
	});

	describe('POST /api/playlists/import', () => {
		it('rejects unauthenticated requests with 401', async () => {
			await expect(POST(makeEvent({}, null))).rejects.toMatchObject({
				status: 401
			});
		});

		it('returns a recoverable result for an empty playlist selection', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			const res = await POST(makeEvent({ tidalPlaylistIds: [] }));
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json).toMatchObject({
				totalImported: 0,
				totalErrors: 0,
				error: 'invalid_playlist_selection'
			});
		});

		it('imports specified playlists', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			mocks.pullPlaylist.mockResolvedValue({
				playlistId: 'p1',
				tidalPlaylistId: 'pl-1',
				status: 'created',
				tracksAdded: 5,
				tracksRemoved: 0,
				tracksSkipped: 1,
				tracksReplaced: 2,
				streamValidation: 'verified'
			});

			const res = await POST(makeEvent({ tidalPlaylistIds: ['pl-1'] }));
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.totalImported).toBe(1);
			expect(json.totalErrors).toBe(0);
			expect(json.totalTracksSkipped).toBe(1);
			expect(json.totalTracksReplaced).toBe(2);
			expect(json.streamValidation).toBe('verified');
			expect(mocks.pullPlaylist).toHaveBeenCalledWith(
				'pl-1',
				expect.not.objectContaining({ validateStreams: expect.anything() })
			);
		});

		it('does not surface malformed playlist identifiers as an HTTP 400', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			const res = await POST(makeEvent({ tidalPlaylistIds: ['ok', 7] }));
			expect(res.status).toBe(200);
			expect((await res.json()).error).toBe('invalid_playlist_selection');
			expect(mocks.pullPlaylist).not.toHaveBeenCalled();
		});

		it('does not surface malformed JSON as an HTTP 400', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			const res = await POST(
				makeEvent({}, { id: 'u1' }, true, new SyntaxError('Unexpected end of JSON input'))
			);
			expect(res.status).toBe(200);
			expect((await res.json()).error).toBe('invalid_playlist_selection');
		});

		it('returns a TIDAL import failure in the normal result payload', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			mocks.pullPlaylist.mockResolvedValue({
				playlistId: '',
				tidalPlaylistId: 'pl-1',
				status: 'error',
				tracksAdded: 0,
				tracksRemoved: 0,
				tracksSkipped: 0,
				tracksReplaced: 0,
				streamValidation: 'deferred',
				error: 'Unable to import this playlist from TIDAL. Please try again.'
			});

			const res = await POST(makeEvent({ tidalPlaylistIds: ['pl-1'] }));
			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({ totalImported: 0, totalErrors: 1 });
		});
	});
});
