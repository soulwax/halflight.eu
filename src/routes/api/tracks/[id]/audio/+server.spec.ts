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

function makeEvent(
	trackId = 'trk-1',
	user: { id: string } | null = { id: 'u1' },
	headers: Record<string, string> = {}
) {
	const req = new Request(`http://localhost:3000/api/tracks/${trackId}/audio`, {
		headers: new Headers(headers)
	});
	return {
		locals: { user },
		params: { id: trackId },
		url: new URL(`http://localhost:3000/api/tracks/${trackId}/audio`),
		request: req,
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/audio', () => {
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

	it('rejects an unconfigured install with 503', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ configured: false, hasPlayback: false });
		await expect(GET(makeEvent('trk-1'))).rejects.toMatchObject({
			status: 503
		});
	});

	it('rejects with 403 when playback is not linked', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ configured: true, hasPlayback: false });
		await expect(GET(makeEvent('trk-1'))).rejects.toMatchObject({ status: 403 });
		expect(mocks.fetchTrackStream).not.toHaveBeenCalled();
	});

	it('proxies CDN stream with audio content headers and forward range headers', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ configured: true, hasPlayback: true });
		mocks.fetchTrackStream.mockResolvedValue({
			trackId: 101,
			streamUrl: 'https://sp-pr-cf.audio.tidal.com/test-audio.mp4',
			urls: ['https://sp-pr-cf.audio.tidal.com/test-audio.mp4'],
			fileExtension: '.m4a',
			mimeType: 'audio/mp4',
			codecs: 'mp4a.40.2',
			audioMode: 'STEREO',
			audioQuality: 'HIGH'
		});

		fetchMock.mockResolvedValueOnce(
			new Response(new Uint8Array([0, 1, 2, 3]), {
				status: 206,
				headers: {
					'Content-Length': '4',
					'Content-Range': 'bytes 0-3/1000'
				}
			})
		);

		const res = await GET(makeEvent('101', { id: 'u1' }, { Range: 'bytes=0-3' }));
		expect(res.status).toBe(206);
		expect(res.headers.get('Content-Type')).toBe('audio/mp4');
		expect(res.headers.get('Accept-Ranges')).toBe('bytes');
		expect(fetchMock).toHaveBeenCalledWith('https://sp-pr-cf.audio.tidal.com/test-audio.mp4', {
			headers: expect.objectContaining({
				Range: 'bytes=0-3'
			})
		});
	});

	it('throws 403 if the device token is rejected upstream', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ configured: true, hasPlayback: true });
		mocks.fetchTrackStream.mockRejectedValue(
			new TidalApiError(403, 'Forbidden', null, 'playbackinfopostpaywall')
		);

		await expect(GET(makeEvent('101'))).rejects.toMatchObject({
			status: 403
		});
	});
});
