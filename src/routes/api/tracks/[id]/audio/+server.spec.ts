import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	resolveTrackStream: vi.fn(),
	getStreamingSettings: vi.fn(),
	getRequestedStreamQuality: vi.fn()
}));

vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: mocks.getStreamingSettings,
	isStreamingQuality: (value: string) => ['LOW', 'HIGH', 'LOSSLESS'].includes(value)
}));
vi.mock('#lib/server/tidal', async (importOriginal) => ({
	...((await importOriginal()) as object),
	getConnectionStatus: mocks.getConnectionStatus,
	resolveTrackStream: mocks.resolveTrackStream,
	getRequestedStreamQuality: mocks.getRequestedStreamQuality
}));

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

const fetchMock = vi.fn();

function event(range?: string) {
	return {
		locals: { user: { id: 'owner-1' } },
		params: { id: '123' },
		url: new URL('https://syn.test/api/tracks/123/audio'),
		request: new Request('https://syn.test/api/tracks/123/audio', {
			headers: range ? { range } : undefined
		}),
		fetch: fetchMock,
		cookies: {} as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/audio', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.resolveTrackStream.mockReset();
		mocks.getStreamingSettings.mockReset();
		mocks.getRequestedStreamQuality.mockReset();
		fetchMock.mockReset();
		mocks.getConnectionStatus.mockResolvedValue({ configured: true, hasPlayback: true });
		mocks.getStreamingSettings.mockResolvedValue({ preferredQuality: 'HIGH' });
		mocks.getRequestedStreamQuality.mockResolvedValue('HIGH');
		mocks.resolveTrackStream.mockResolvedValue({
			streamUrl: 'https://cdn.example.test/audio',
			mimeType: 'audio/mp4'
		});
		fetchMock.mockResolvedValue(
			new Response(new Uint8Array([1, 2]), {
				status: 206,
				headers: {
					'content-length': '2',
					'content-range': 'bytes 0-1/2',
					'content-type': 'audio/mp4; codecs=mp4a.40.2'
				}
			})
		);
	});

	it('proxies media and forwards the byte range', async () => {
		const response = await GET(event('bytes=0-1'));
		expect(response.status).toBe(206);
		expect(response.headers.get('Accept-Ranges')).toBe('bytes');
		expect(response.headers.get('Content-Type')).toBe('audio/mp4; codecs=mp4a.40.2');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://cdn.example.test/audio',
			expect.objectContaining({ headers: expect.any(Headers) })
		);
		expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Range')).toBe('bytes=0-1');
	});
});
