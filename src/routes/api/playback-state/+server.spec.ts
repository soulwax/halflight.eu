import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getPlaybackState: vi.fn(),
	savePlaybackState: vi.fn(),
	parsePlaybackState: vi.fn()
}));

vi.mock('#lib/server/playback-state', () => mocks);

import { GET, PUT } from './+server';

const state = { currentTrack: null, queue: [], history: [], currentTime: 0 };

function event(request = new Request('https://syn.test/api/playback-state')) {
	return {
		locals: { user: { id: 'owner-1' } },
		request
	} as unknown as Parameters<typeof GET>[0];
}

describe('/api/playback-state', () => {
	beforeEach(() => {
		mocks.getPlaybackState.mockReset();
		mocks.savePlaybackState.mockReset();
		mocks.parsePlaybackState.mockReset();
		mocks.getPlaybackState.mockResolvedValue(state);
		mocks.parsePlaybackState.mockReturnValue(state);
		mocks.savePlaybackState.mockResolvedValue(state);
	});

	it('returns the signed-in owner’s saved resume state', async () => {
		expect(await (await GET(event())).json()).toEqual(state);
		expect(mocks.getPlaybackState).toHaveBeenCalledWith('owner-1');
	});

	it('validates and saves JSON state', async () => {
		const request = new Request('https://syn.test/api/playback-state', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(state)
		});
		const response = await PUT(event(request) as Parameters<typeof PUT>[0]);
		expect(response.status).toBe(200);
		expect(mocks.savePlaybackState).toHaveBeenCalledWith('owner-1', state);
	});

	it('rejects a request without JSON content', async () => {
		const request = new Request('https://syn.test/api/playback-state', { method: 'PUT' });
		await expect(PUT(event(request) as Parameters<typeof PUT>[0])).rejects.toMatchObject({
			status: 415
		});
	});
});
