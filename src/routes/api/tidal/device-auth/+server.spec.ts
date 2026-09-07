import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		requestDeviceAuthorization: vi.fn()
	};
});

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		requestDeviceAuthorization: mocks.requestDeviceAuthorization
	};
});

import { POST } from './+server';

function makeEvent(user: { id: string } | null = { id: 'admin-1' }, isAdmin = true) {
	return {
		locals: { user, isAdministrator: isAdmin },
		fetch: vi.fn()
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/tidal/device-auth', () => {
	beforeEach(() => {
		mocks.requestDeviceAuthorization.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(POST(makeEvent(null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('rejects a signed-in non-owner with 401', async () => {
		await expect(POST(makeEvent({ id: 'someone-else' }, false))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns a safe error when the device authorization request fails', async () => {
		mocks.requestDeviceAuthorization.mockRejectedValueOnce(
			new Error('provider response includes private detail')
		);

		const response = await POST(makeEvent());

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'device_authorization_unavailable' });
	});

	it('returns device code and verification URL', async () => {
		mocks.requestDeviceAuthorization.mockResolvedValueOnce({
			deviceCode: 'code-123',
			userCode: 'XYZW',
			verificationUri: 'link.tidal.com',
			verificationUriComplete: 'link.tidal.com/XYZW',
			expiresIn: 300,
			interval: 2
		});

		const res = await POST(makeEvent());
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.deviceCode).toBe('code-123');
		expect(data.userCode).toBe('XYZW');
		expect(data.verificationUriComplete).toBe('link.tidal.com/XYZW');
	});
});
