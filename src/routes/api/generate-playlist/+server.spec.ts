import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		search: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { search: mocks.search }
}));

import type { Cookies } from '@sveltejs/kit';
import { POST } from './+server';

const fetchMock = vi.fn();

function makeEvent(body: Record<string, unknown> = {}, user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		request: {
			json: vi.fn().mockResolvedValue(body)
		},
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/generate-playlist', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.search.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(POST(makeEvent({}, null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns 503 if TIDAL is not connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });
		const res = await POST(makeEvent({ vibe: 'energy', era: 'modern' }));
		expect(res.status).toBe(503);
		const data = await res.json();
		expect(data).toEqual({ error: 'not_connected' });
	});

	it('generates a playlist with tracks and titles when connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.search.mockResolvedValue({
			data: [
				{
					id: 'track-gen-1',
					type: 'tracks',
					attributes: {
						title: 'Generated Synth Track',
						duration: 210,
						cover: 'https://resources.tidal.com/images/example/640x640.jpg',
						artistName: 'Synth Master'
					},
					relationships: {}
				}
			],
			included: []
		});

		const res = await POST(makeEvent({ vibe: 'energy', era: 'modern', focus: 'energy' }));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.title).toContain('HIGH KINETIC');
		expect(data.tracks).toHaveLength(1);
		expect(data.tracks[0].title).toBe('Generated Synth Track');
		expect(data.tracks[0].artists[0].name).toBe('Synth Master');
	});
});
