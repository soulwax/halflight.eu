import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		pollDeviceToken: vi.fn(),
		writePlaybackRecord: vi.fn()
	};
});

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		pollDeviceToken: mocks.pollDeviceToken,
		writePlaybackRecord: mocks.writePlaybackRecord
	};
});

import { POST } from './+server';

function makeEvent(
	body: object,
	user: { id: string } | null = { id: 'admin-1' },
	isListener = true
) {
	return {
		locals: { user, isListener },
		request: new Request('http://localhost:3000/api/tidal/device-auth/poll', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		fetch: vi.fn(),
		cookies: {}
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/tidal/device-auth/poll', () => {
	beforeEach(() => {
		mocks.pollDeviceToken.mockReset();
		mocks.writePlaybackRecord.mockReset();
	});

	it('rejects a signed-in non-owner before polling the playback token', async () => {
		await expect(
			POST(makeEvent({ deviceCode: 'dev-123' }, { id: 'someone-else' }, false))
		).rejects.toMatchObject({
			status: 401
		});
		expect(mocks.pollDeviceToken).not.toHaveBeenCalled();
	});

	it('returns a safe failure state when polling fails', async () => {
		mocks.pollDeviceToken.mockRejectedValueOnce(
			new Error('provider response includes private detail')
		);

		const response = await POST(makeEvent({ deviceCode: 'dev-123' }));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ status: 'error' });
	});

	it('returns pending while waiting', async () => {
		mocks.pollDeviceToken.mockResolvedValueOnce({ status: 'pending' });

		const res = await POST(makeEvent({ deviceCode: 'dev-123' }));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.status).toBe('pending');
		expect(mocks.writePlaybackRecord).not.toHaveBeenCalled();
	});

	it('saves token on success', async () => {
		const mockRecord = {
			accessToken: 'acc',
			refreshToken: 'ref',
			expiresAt: Date.now() + 86400000,
			tokenType: 'Bearer',
			scope: ['r_usr'],
			obtainedAt: Date.now()
		};

		mocks.pollDeviceToken.mockResolvedValueOnce({
			status: 'success',
			record: mockRecord
		});

		const res = await POST(makeEvent({ deviceCode: 'dev-123' }));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.status).toBe('success');
		expect(mocks.writePlaybackRecord).toHaveBeenCalledWith(mockRecord);
	});
});
