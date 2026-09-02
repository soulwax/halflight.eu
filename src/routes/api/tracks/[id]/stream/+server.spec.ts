import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		fetchTrackStream: vi.fn()
	};
});

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		getConnectionStatus: mocks.getConnectionStatus,
		fetchTrackStream: mocks.fetchTrackStream
	};
});

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';
import { TidalApiError } from '#lib/server/tidal';

const fetchMock = vi.fn();

function makeEvent(trackId = 'trk-1', user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		params: { id: trackId },
		url: new URL(`http://localhost:3000/api/tracks/${trackId}/stream`),
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/stream', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.fetchTrackStream.mockReset();
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

	it('extracts direct stream URL from playbackinfopostpaywall base64 manifest', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });

		mocks.fetchTrackStream.mockResolvedValueOnce({
			trackId: 123,
			streamUrl: 'https://sp-pr-cf.audio.tidal.com/stream-123.mp4',
			urls: ['https://sp-pr-cf.audio.tidal.com/stream-123.mp4'],
			fileExtension: '.m4a',
			mimeType: 'audio/mp4',
			codecs: 'mp4a.40.2',
			audioMode: 'STEREO',
			audioQuality: 'HIGH',
			bitDepth: 16,
			sampleRate: 44100
		});

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.streamUrl).toBe('https://sp-pr-cf.audio.tidal.com/stream-123.mp4');
		expect(data.mimeType).toBe('audio/mp4');
		expect(data.audioMode).toBe('STEREO');
	});

	it('returns 403 with requiresFullAuth when playback permission is missing', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.fetchTrackStream.mockRejectedValue(
			new TidalApiError(
				401,
				'Token is missing required scope',
				{
					status: 401,
					subStatus: 11004
				},
				'playbackinfopostpaywall'
			)
		);

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.requiresFullAuth).toBe(true);
		expect(data.error).toBe('playback_unauthorized');
	});
});
