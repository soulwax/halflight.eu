import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		tidalFetch: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalFetch: mocks.tidalFetch
}));

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

const fetchMock = vi.fn();

function makeEvent(trackId = 'trk-1', user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		params: { id: trackId },
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/stream', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.tidalFetch.mockReset();
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

		const manifestObj = {
			mimeType: 'audio/mp4',
			codecs: 'mp4a.40.2',
			encryptionType: 'NONE',
			urls: ['https://sp-pr-cf.audio.tidal.com/stream-123.mp4']
		};
		const encodedManifest = Buffer.from(JSON.stringify(manifestObj)).toString('base64');

		mocks.tidalFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				manifestMimeType: 'application/vnd.tidal.bts',
				manifest: encodedManifest,
				audioMode: 'STEREO',
				bitDepth: 16,
				sampleRate: 44100
			})
		});

		const res = await GET(makeEvent('trk-123'));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.streamUrl).toBe('https://sp-pr-cf.audio.tidal.com/stream-123.mp4');
		expect(data.mimeType).toBe('audio/mp4');
		expect(data.audioMode).toBe('STEREO');
	});
});
