import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		resolveTrackStream: vi.fn(),
		getStreamingSettings: vi.fn()
	};
});

vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: mocks.getStreamingSettings,
	isStreamingQuality: (value: string) => ['LOW', 'HIGH', 'LOSSLESS'].includes(value)
}));

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		getConnectionStatus: mocks.getConnectionStatus,
		resolveTrackStream: mocks.resolveTrackStream
	};
});

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';
import {
	TidalApiError,
	TidalPlaybackNotLinkedError,
	TidalQualityDeniedError
} from '#lib/server/tidal';

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

const linked = { configured: true, connected: true, hasPlayback: true };

describe('GET /api/tracks/[id]/stream', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.resolveTrackStream.mockReset();
		mocks.getStreamingSettings.mockReset();
		mocks.getStreamingSettings.mockResolvedValue({ preferredQuality: 'HIGH' });
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(GET(makeEvent('trk-1', null))).rejects.toMatchObject({ status: 401 });
	});

	it('returns 503 when TIDAL is not configured', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ configured: false, hasPlayback: false });
		const res = await GET(makeEvent('trk-1'));
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: 'not_connected' });
	});

	it('returns 403 requiresFullAuth when playback is not linked', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ configured: true, hasPlayback: false });
		const res = await GET(makeEvent('trk-1'));
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.requiresFullAuth).toBe(true);
		expect(data.reason).toBe('not_linked');
		expect(mocks.resolveTrackStream).not.toHaveBeenCalled();
	});

	it('returns the resolved stream info', async () => {
		mocks.getConnectionStatus.mockResolvedValue(linked);
		mocks.resolveTrackStream.mockResolvedValueOnce({
			trackId: 123,
			streamUrl: 'https://cdn.tidal.com/stream-123.mp4',
			urls: ['https://cdn.tidal.com/stream-123.mp4'],
			fileExtension: '.m4a',
			mimeType: 'audio/mp4',
			codecs: 'mp4a.40.2',
			audioMode: 'STEREO',
			audioQuality: 'HIGH'
		});

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.streamUrl).toBe('https://cdn.tidal.com/stream-123.mp4');
		expect(data.requiresFullAuth).toBe(false);
		expect(mocks.resolveTrackStream).toHaveBeenCalledWith(
			'trk-123',
			expect.objectContaining({ quality: 'HIGH' })
		);
	});

	it('returns 403 plan_no_streaming (not requiresFullAuth) when every quality is denied', async () => {
		mocks.getConnectionStatus.mockResolvedValue(linked);
		mocks.resolveTrackStream.mockRejectedValue(
			new TidalQualityDeniedError(['LOSSLESS', 'HIGH', 'LOW'])
		);

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.error).toBe('plan_no_streaming');
		expect(data.requiresFullAuth).toBe(false);
	});

	it('returns 403 requiresFullAuth when the device token is rejected', async () => {
		mocks.getConnectionStatus.mockResolvedValue(linked);
		mocks.resolveTrackStream.mockRejectedValue(
			new TidalApiError(401, 'Token expired', { subStatus: 11002 }, 'playbackinfo')
		);

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(403);
		expect((await res.json()).requiresFullAuth).toBe(true);
	});

	it('surfaces a not-linked error as 403 requiresFullAuth', async () => {
		mocks.getConnectionStatus.mockResolvedValue(linked);
		mocks.resolveTrackStream.mockRejectedValue(new TidalPlaybackNotLinkedError());

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(403);
		expect((await res.json()).requiresFullAuth).toBe(true);
	});

	it('returns 404 when the stream is unavailable for other reasons', async () => {
		mocks.getConnectionStatus.mockResolvedValue(linked);
		mocks.resolveTrackStream.mockRejectedValue(new Error('boom'));

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(404);
		expect((await res.json()).error).toBe('stream_unavailable');
	});
});
