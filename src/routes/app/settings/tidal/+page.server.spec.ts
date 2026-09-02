import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		readRecord: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus
}));

vi.mock('#lib/server/tidal/store', () => ({
	readRecord: mocks.readRecord
}));

import { load } from './+page.server';

function event(search = '') {
	return {
		url: new URL(`http://localhost/app/settings/tidal${search}`)
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/settings/tidal load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.readRecord.mockReset();
	});

	it('returns debugTokens when connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.readRecord.mockResolvedValue({
			accessToken: 'test-access-token',
			refreshToken: 'test-refresh-token',
			expiresAt: 1234567890,
			scope: ['user.read', 'collection.read']
		});

		const result = await load(event());
		expect(result).toMatchObject({
			status: { connected: true, configured: true },
			debugTokens: {
				accessToken: 'test-access-token',
				refreshToken: 'test-refresh-token',
				expiresAt: 1234567890,
				scopes: ['user.read', 'collection.read']
			}
		});
	});

	it('does not load debugTokens when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		const result = await load(event());
		expect(result).toMatchObject({
			status: { connected: false, configured: true },
			debugTokens: null
		});
		expect(mocks.readRecord).not.toHaveBeenCalled();
	});
});
