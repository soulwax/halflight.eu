import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	resolveTrackStream: vi.fn(),
	getStreamingSettings: vi.fn(),
	getRequestedStreamQuality: vi.fn(),
	describePlaybackDelivery: vi.fn()
}));

vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: mocks.getStreamingSettings,
	isStreamingQuality: (value: string) => ['LOW', 'HIGH', 'LOSSLESS'].includes(value)
}));
vi.mock('#lib/server/tidal', async (importOriginal) => ({
	...((await importOriginal()) as object),
	getConnectionStatus: mocks.getConnectionStatus,
	resolveTrackStream: mocks.resolveTrackStream,
	getRequestedStreamQuality: mocks.getRequestedStreamQuality,
	describePlaybackDelivery: mocks.describePlaybackDelivery
}));

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

function event(trackId = '123', user: { id: string } | null = { id: 'owner-1' }) {
	return {
		locals: { user },
		params: { id: trackId },
		url: new URL(`https://syn.test/api/tracks/${trackId}/stream`),
		fetch: vi.fn(),
		cookies: {} as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/stream', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.resolveTrackStream.mockReset();
		mocks.getStreamingSettings.mockReset();
		mocks.getRequestedStreamQuality.mockReset();
		mocks.describePlaybackDelivery.mockReset();
		mocks.getConnectionStatus.mockResolvedValue({ configured: true, hasPlayback: true });
		mocks.getStreamingSettings.mockResolvedValue({ preferredQuality: 'LOSSLESS' });
		mocks.getRequestedStreamQuality.mockResolvedValue('LOSSLESS');
		mocks.describePlaybackDelivery.mockReturnValue({
			format: 'flac',
			mimeType: 'audio/flac',
			lossless: true,
			nominalBitrateKbps: null
		});
		mocks.resolveTrackStream.mockResolvedValue({
			trackId: 123,
			streamUrl: 'https://cdn.example.test/opaque',
			urls: ['https://cdn.example.test/opaque'],
			fileExtension: '.flac',
			mimeType: 'audio/flac',
			codecs: 'flac',
			audioMode: 'STEREO',
			audioQuality: 'LOSSLESS'
		});
	});

	it('requires a signed-in user', async () => {
		await expect(GET(event('123', null))).rejects.toMatchObject({ status: 401 });
	});

	it('keeps the existing connection and Link gates', async () => {
		mocks.getConnectionStatus.mockResolvedValueOnce({ configured: false, hasPlayback: false });
		expect((await GET(event())).status).toBe(503);
		mocks.getConnectionStatus.mockResolvedValueOnce({ configured: true, hasPlayback: false });
		expect((await GET(event())).status).toBe(403);
	});

	it('resolves native playback at the saved quality', async () => {
		const response = await GET(event());
		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			audioQuality: 'LOSSLESS',
			delivery: { format: 'flac', lossless: true },
			isPreview: false
		});
		expect(body).not.toHaveProperty('streamUrl');
		expect(body).not.toHaveProperty('urls');
		expect(mocks.resolveTrackStream).toHaveBeenCalledWith(
			'123',
			expect.objectContaining({ quality: 'LOSSLESS' })
		);
	});
});
