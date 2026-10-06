import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		fetchTrackLyrics: vi.fn()
	};
});

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		getConnectionStatus: mocks.getConnectionStatus,
		fetchTrackLyrics: mocks.fetchTrackLyrics
	};
});

import type { Cookies } from '@sveltejs/kit';
import { __resetLyricsCache } from '#lib/server/tidal';
import { GET } from './+server';

const fetchMock = vi.fn();

function makeEvent(
	trackId = 'trk-1',
	user: { id: string } | null = { id: 'u1' },
	isAdministrator = true,
	searchParams?: Record<string, string>
) {
	const url = new URL(`http://localhost/api/tracks/${trackId}/lyrics`);
	if (searchParams) {
		for (const [k, v] of Object.entries(searchParams)) {
			url.searchParams.set(k, v);
		}
	}
	return {
		locals: { user, isAdministrator },
		params: { id: trackId },
		url,
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/lyrics', () => {
	beforeEach(() => {
		__resetLyricsCache();
		mocks.getConnectionStatus.mockReset();
		mocks.fetchTrackLyrics.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(GET(makeEvent('trk-1', null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns 503 if not connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });
		const res = await GET(makeEvent('trk-1'));
		expect(res.status).toBe(503);
		const data = await res.json();
		expect(data).toEqual({ error: 'not_connected' });
	});

	it('returns lyrics and cues on success', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.fetchTrackLyrics.mockResolvedValueOnce({
			trackId: 101,
			lyrics: 'Sing along',
			subtitles: '[00:01.00] Sing along',
			cues: [{ time: 1, text: 'Sing along' }],
			isRightToLeft: false,
			lyricsProvider: 'Musixmatch'
		});

		const res = await GET(makeEvent('101'));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.trackId).toBe(101);
		expect(data.cues).toEqual([{ time: 1, text: 'Sing along' }]);
	});

	it('falls back to LRCLIB when TIDAL lyrics fail', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.fetchTrackLyrics.mockRejectedValueOnce(new Error('TIDAL 404'));
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				syncedLyrics: '[00:02.50] Hello from LRCLIB',
				plainLyrics: 'Hello from LRCLIB',
				instrumental: false
			})
		});

		const res = await GET(
			makeEvent('101', { id: 'u1' }, true, { title: 'Track Title', artist: 'Artist Name' })
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.lyricsProvider).toBe('LRCLIB');
		expect(data.cues).toEqual([{ time: 2.5, text: 'Hello from LRCLIB' }]);
		expect(data.lyrics).toBe('Hello from LRCLIB');
	});

	it('falls back to Lyrics.ovh when LRCLIB returns 404', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.fetchTrackLyrics.mockRejectedValueOnce(new Error('TIDAL 404'));
		// LRCLIB exact fails
		fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
		// LRCLIB search fails
		fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
		// Lyrics.ovh succeeds
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ lyrics: 'Plain text lyrics from OVH' })
		});

		const res = await GET(
			makeEvent('102', { id: 'u1' }, true, { title: 'Track Title', artist: 'Artist Name' })
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.lyricsProvider).toBe('Lyrics.ovh');
		expect(data.lyrics).toBe('Plain text lyrics from OVH');
	});

	it('returns 404 lyrics_unavailable when all fallbacks fail', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.fetchTrackLyrics.mockRejectedValueOnce(new Error('TIDAL 404'));
		fetchMock.mockResolvedValue({ ok: false, status: 404 });

		const res = await GET(
			makeEvent('103', { id: 'u1' }, true, { title: 'Track Title', artist: 'Artist Name' })
		);
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data).toEqual({ error: 'lyrics_unavailable' });
	});
});
