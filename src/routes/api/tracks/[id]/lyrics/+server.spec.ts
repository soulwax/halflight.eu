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
import { GET } from './+server';

const fetchMock = vi.fn();

function makeEvent(
	trackId = 'trk-1',
	user: { id: string } | null = { id: 'u1' },
	isAdministrator = true
) {
	return {
		locals: { user, isAdministrator },
		params: { id: trackId },
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/lyrics', () => {
	beforeEach(() => {
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
});
