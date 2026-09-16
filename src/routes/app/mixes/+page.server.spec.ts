import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class MockTidalApiError extends Error {
		constructor(readonly status: number) {
			super(`TIDAL API ${status}`);
		}
	}

	class MockTidalAuthError extends Error {}
	class MockTidalNotConnectedError extends Error {}

	return {
		getConnectionStatus: vi.fn(),
		getMix: vi.fn(),
		MockTidalApiError,
		MockTidalAuthError,
		MockTidalNotConnectedError
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getMix: mocks.getMix },
	TidalApiError: mocks.MockTidalApiError,
	TidalAuthError: mocks.MockTidalAuthError,
	TidalNotConnectedError: mocks.MockTidalNotConnectedError,
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event() {
	return {
		locals: { user: { id: 'user-1' } },
		fetch: fetchMock
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/mixes load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getMix.mockReset();
		fetchMock.mockReset();
	});

	it('returns daily, discovery, and new release mixes', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getMix.mockImplementation((kind) => {
			if (kind === 'daily') {
				return Promise.resolve({
					data: {
						id: 'daily-1',
						type: 'userDailyMixes',
						attributes: { title: 'Daily Mix 1' },
						relationships: { items: { data: [{ id: 'track-1', type: 'tracks' }] } }
					},
					included: [{ id: 'track-1', type: 'tracks', attributes: { title: 'Track One' } }]
				});
			}
			if (kind === 'discovery') {
				return Promise.resolve({
					data: {
						id: 'disc-1',
						type: 'userDiscoveryMixes',
						attributes: { title: 'Discovery Mix' },
						relationships: { items: { data: [] } }
					},
					included: []
				});
			}
			return Promise.resolve({
				data: {
					id: 'new-1',
					type: 'userNewReleaseMixes',
					attributes: { title: 'New Arrivals' },
					relationships: { items: { data: [] } }
				},
				included: []
			});
		});

		const result = await load(event());
		expect(result).toMatchObject({
			connected: true,
			configured: true,
			state: null,
			dailyMix: { title: 'Daily Mix 1', items: [{ id: 'track-1' }] },
			discoveryMix: { title: 'Discovery Mix' },
			newReleaseMix: { title: 'New Arrivals' }
		});
	});

	it('returns disconnected state when not connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		const result = await load(event());
		expect(result).toMatchObject({
			connected: false,
			configured: true,
			state: 'not_connected'
		});
	});
});
