import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getStreamingSettings: vi.fn(),
	createPlaybackJob: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({ getConnectionStatus: mocks.getConnectionStatus }));
vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: mocks.getStreamingSettings,
	isStreamingQuality: (value: string) => ['LOW', 'HIGH', 'LOSSLESS'].includes(value)
}));
vi.mock('#lib/server/streamrip-jobs', () => ({ createPlaybackJob: mocks.createPlaybackJob }));

import { GET } from './+server';

function event(trackId = '123', user: { id: string } | null = { id: 'owner-1' }) {
	return {
		locals: { user },
		params: { id: trackId },
		url: new URL(`https://syn.test/api/tracks/${trackId}/stream`),
		fetch: vi.fn()
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/stream', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getStreamingSettings.mockReset();
		mocks.createPlaybackJob.mockReset();
		mocks.getConnectionStatus.mockResolvedValue({ configured: true, hasPlayback: true });
		mocks.getStreamingSettings.mockResolvedValue({
			preferredQuality: 'LOSSLESS',
			loudnessNormalization: true
		});
		mocks.createPlaybackJob.mockResolvedValue({
			jobId: 'audit-job',
			session: {
				id: 'worker-session',
				playbackUrl: 'https://media.example.test/ticket/opaque',
				expiresAt: '2026-09-03T12:00:00.000Z',
				audioQuality: 'LOSSLESS',
				mimeType: 'audio/flac',
				fileExtension: '.flac'
			}
		});
	});

	it('requires a signed-in user', async () => {
		await expect(GET(event('123', null))).rejects.toMatchObject({ status: 401 });
	});

	it('keeps the existing connection and Link gates', async () => {
		mocks.getConnectionStatus.mockResolvedValueOnce({ configured: false, hasPlayback: false });
		expect((await GET(event())).status).toBe(503);

		mocks.getConnectionStatus.mockResolvedValueOnce({ configured: true, hasPlayback: false });
		const response = await GET(event());
		expect(response.status).toBe(403);
		expect((await response.json()).requiresFullAuth).toBe(true);
	});

	it('returns only the short-lived worker ticket and persists the job server-side', async () => {
		const response = await GET(event());
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			streamUrl: 'https://media.example.test/ticket/opaque',
			jobId: 'audit-job',
			audioQuality: 'LOSSLESS'
		});
		expect(mocks.createPlaybackJob).toHaveBeenCalledWith(
			'owner-1',
			'123',
			'LOSSLESS',
			true,
			expect.any(Function)
		);
	});
});
