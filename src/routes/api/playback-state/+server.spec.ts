import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getPlaybackState: vi.fn(),
	savePlaybackState: vi.fn(),
	parsePlaybackState: vi.fn(),
	parsePlaybackStateOrigin: vi.fn(),
	parsePlaybackStateRevision: vi.fn()
}));

vi.mock('#lib/server/playback-state', () => mocks);

import { GET, PUT } from './+server';

const state = { currentTrack: null, queue: [], history: [], currentTime: 0 };

function event(
	request = new Request('https://syn.test/api/playback-state'),
	isAdministrator = true
) {
	return {
		locals: { user: { id: 'owner-1' }, isAdministrator },
		request
	} as unknown as Parameters<typeof GET>[0];
}

describe('/api/playback-state', () => {
	beforeEach(() => {
		mocks.getPlaybackState.mockReset();
		mocks.savePlaybackState.mockReset();
		mocks.parsePlaybackState.mockReset();
		mocks.parsePlaybackStateOrigin.mockReset();
		mocks.parsePlaybackStateRevision.mockReset();
		mocks.getPlaybackState.mockResolvedValue(state);
		mocks.parsePlaybackState.mockReturnValue(state);
		mocks.parsePlaybackStateOrigin.mockReturnValue('listening-room');
		mocks.parsePlaybackStateRevision.mockReturnValue(0);
		mocks.savePlaybackState.mockResolvedValue({ state, conflict: false });
	});

	it('returns the signed-in owner’s saved resume state', async () => {
		expect(await (await GET(event())).json()).toEqual(state);
		expect(mocks.getPlaybackState).toHaveBeenCalledWith('owner-1');
	});

	it('does not expose the owner session to a non-administrator account', async () => {
		await expect(GET(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.getPlaybackState).not.toHaveBeenCalled();
	});

	it('validates and saves JSON state', async () => {
		const request = new Request('https://syn.test/api/playback-state', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...state, revision: 0, origin: 'listening-room' })
		});
		const response = await PUT(event(request) as Parameters<typeof PUT>[0]);
		expect(response.status).toBe(200);
		expect(mocks.savePlaybackState).toHaveBeenCalledWith('owner-1', state, 0, 'listening-room');
	});

	it('returns the latest state when another site has already written a newer revision', async () => {
		mocks.savePlaybackState.mockResolvedValue({ state, conflict: true });
		const request = new Request('https://syn.test/api/playback-state', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...state, revision: 0, origin: 'listening-room' })
		});
		const response = await PUT(event(request) as Parameters<typeof PUT>[0]);
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual(state);
	});

	it('rejects a request without a valid revision and named product origin', async () => {
		mocks.parsePlaybackStateRevision.mockReturnValue(null);
		const request = new Request('https://syn.test/api/playback-state', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(state)
		});
		await expect(PUT(event(request) as Parameters<typeof PUT>[0])).rejects.toMatchObject({
			status: 400
		});
	});

	it('rejects a request without JSON content', async () => {
		const request = new Request('https://syn.test/api/playback-state', { method: 'PUT' });
		await expect(PUT(event(request) as Parameters<typeof PUT>[0])).rejects.toMatchObject({
			status: 415
		});
	});
});
