import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	applyPlaybackIntent: vi.fn(),
	parsePlaybackIntent: vi.fn()
}));

vi.mock('#lib/server/playback-state', () => mocks);

import { POST } from './+server';

const state = {
	currentTrack: null,
	queue: [],
	history: [],
	currentTime: 0,
	revision: 1,
	lastOrigin: 'listening-room'
};
const intent = {
	expectedRevision: 0,
	operationId: 'operation-1',
	origin: 'listening-room',
	intent: { type: 'queue.clear' }
};

function event(
	request = new Request('https://syn.test/api/playback-state/intents', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(intent)
	}),
	isAdministrator = true
) {
	return {
		locals: { user: { id: 'owner-1' }, isAdministrator },
		request
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/playback-state/intents', () => {
	beforeEach(() => {
		mocks.applyPlaybackIntent.mockReset();
		mocks.parsePlaybackIntent.mockReset();
		mocks.parsePlaybackIntent.mockReturnValue(intent);
		mocks.applyPlaybackIntent.mockResolvedValue({ state, conflict: false, duplicate: false });
	});

	it('applies a validated intent for the signed-in owner', async () => {
		const response = await POST(event());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(state);
		expect(mocks.parsePlaybackIntent).toHaveBeenCalledWith(intent);
		expect(mocks.applyPlaybackIntent).toHaveBeenCalledWith('owner-1', intent);
	});

	it('does not expose playback mutations to a non-administrator account', async () => {
		await expect(POST(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.parsePlaybackIntent).not.toHaveBeenCalled();
		expect(mocks.applyPlaybackIntent).not.toHaveBeenCalled();
	});

	it('requires a JSON request body', async () => {
		const request = new Request('https://syn.test/api/playback-state/intents', { method: 'POST' });
		await expect(POST(event(request))).rejects.toMatchObject({ status: 415 });
		expect(mocks.parsePlaybackIntent).not.toHaveBeenCalled();
	});

	it('rejects malformed JSON before it reaches the service', async () => {
		mocks.parsePlaybackIntent.mockReturnValue(null);
		const request = new Request('https://syn.test/api/playback-state/intents', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{not-json'
		});
		await expect(POST(event(request))).rejects.toMatchObject({ status: 400 });
		expect(mocks.parsePlaybackIntent).toHaveBeenCalledWith(null);
		expect(mocks.applyPlaybackIntent).not.toHaveBeenCalled();
	});

	it('rejects an unrecognised intent before it reaches the service', async () => {
		mocks.parsePlaybackIntent.mockReturnValue(null);
		await expect(POST(event())).rejects.toMatchObject({ status: 400 });
		expect(mocks.applyPlaybackIntent).not.toHaveBeenCalled();
	});

	it('returns the latest state when the intent conflicts with a newer revision', async () => {
		mocks.applyPlaybackIntent.mockResolvedValue({ state, conflict: true, duplicate: false });
		const response = await POST(event());
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual(state);
	});
});
