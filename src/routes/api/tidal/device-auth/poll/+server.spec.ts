import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		pollDeviceToken: vi.fn(),
		writeRecord: vi.fn(),
		writeTokenCookie: vi.fn()
	};
});

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		pollDeviceToken: mocks.pollDeviceToken,
		writeRecord: mocks.writeRecord,
		writeTokenCookie: mocks.writeTokenCookie
	};
});

import { POST } from './+server';

function makeEvent(body: object, user: { id: string } | null = { id: 'admin-1' }) {
	return {
		locals: { user, isAdministrator: true },
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
		mocks.writeRecord.mockReset();
		mocks.writeTokenCookie.mockReset();
	});

	it('returns pending while waiting', async () => {
		mocks.pollDeviceToken.mockResolvedValueOnce({ status: 'pending' });

		const res = await POST(makeEvent({ deviceCode: 'dev-123' }));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.status).toBe('pending');
		expect(mocks.writeRecord).not.toHaveBeenCalled();
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
		expect(mocks.writeRecord).toHaveBeenCalledWith(mockRecord);
		expect(mocks.writeTokenCookie).toHaveBeenCalled();
	});
});
