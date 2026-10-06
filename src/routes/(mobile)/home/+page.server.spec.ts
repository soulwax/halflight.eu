import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getMix: vi.fn(),
	normaliseSearchResults: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getMix: mocks.getMix },
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));
vi.mock('#lib/server/tidal/normalise', () => ({
	normaliseSearchResults: mocks.normaliseSearchResults
}));

import type { TrackSummary } from '#lib/tidal/models';
import { load } from './+page.server';

const run = (): Promise<{ dailyMix: TrackSummary[] }> =>
	load(event()) as Promise<{ dailyMix: TrackSummary[] }>;

function event() {
	return {
		locals: { user: { id: 'owner' }, isListener: true },
		fetch: vi.fn(),
		cookies: {}
	} as any;
}

function track(id: string) {
	return { kind: 'track', id, title: `Track ${id}`, artists: [] };
}

describe('/(mobile)/home +page.server', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getMix.mockReset();
		mocks.normaliseSearchResults.mockReset();
	});

	it('returns an empty mix when TIDAL is not connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });

		const result = await run();
		expect(result).toEqual({ dailyMix: [] });
		expect(mocks.getMix).not.toHaveBeenCalled();
	});

	it('caps the daily mix to eight tracks', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getMix.mockResolvedValue({});
		mocks.normaliseSearchResults.mockReturnValue({
			tracks: Array.from({ length: 20 }, (_, i) => track(String(i)))
		});

		const result = await run();
		expect(result.dailyMix).toHaveLength(8);
		expect(result.dailyMix[0].id).toBe('0');
	});

	it('degrades to an empty mix when the mix request fails', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getMix.mockRejectedValue(new Error('upstream 500'));

		const result = await run();
		expect(result).toEqual({ dailyMix: [] });
	});
});
