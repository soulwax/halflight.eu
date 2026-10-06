import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	claimPlaybackDevice: vi.fn(),
	parsePlaybackDeviceId: vi.fn(),
	parsePlaybackStateOrigin: vi.fn()
}));

vi.mock('#lib/server/playback-state', () => mocks);

import { POST } from './+server';

const state = {
	currentTrack: null,
	queue: [],
	history: [],
	currentTime: 0,
	revision: 2,
	lastOrigin: 'halflight-now',
	activeDevice: {
		origin: 'halflight-now',
		expiresAt: '2026-09-08T00:00:45.000Z',
		isCurrent: true
	}
};

function event(
	request = new Request('https://syn.test/api/playback-state/claim', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ deviceId: 'device_123456789', origin: 'halflight-now' })
	}),
	isListener = true
) {
	return {
		locals: { user: { id: 'owner-1' }, isListener },
		request
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/playback-state/claim', () => {
	beforeEach(() => {
		mocks.claimPlaybackDevice.mockReset();
		mocks.parsePlaybackDeviceId.mockReset();
		mocks.parsePlaybackStateOrigin.mockReset();
		mocks.parsePlaybackDeviceId.mockReturnValue('device_123456789');
		mocks.parsePlaybackStateOrigin.mockReturnValue('halflight-now');
		mocks.claimPlaybackDevice.mockResolvedValue(state);
	});

	it('moves the lease only for an authenticated owner action', async () => {
		const response = await POST(event());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(state);
		expect(mocks.claimPlaybackDevice).toHaveBeenCalledWith(
			'owner-1',
			'device_123456789',
			'halflight-now'
		);
	});

	it('does not expose playback takeover to non-administrators', async () => {
		await expect(POST(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.claimPlaybackDevice).not.toHaveBeenCalled();
	});

	it('rejects a missing or malformed claim before it reaches the service', async () => {
		mocks.parsePlaybackDeviceId.mockReturnValue(null);
		await expect(POST(event())).rejects.toMatchObject({ status: 400 });
		expect(mocks.claimPlaybackDevice).not.toHaveBeenCalled();
	});

	it('requires JSON', async () => {
		const request = new Request('https://syn.test/api/playback-state/claim', { method: 'POST' });
		await expect(POST(event(request))).rejects.toMatchObject({ status: 415 });
		expect(mocks.claimPlaybackDevice).not.toHaveBeenCalled();
	});
});
