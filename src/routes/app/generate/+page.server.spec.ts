import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getTasteProfile: vi.fn(),
	getGenerationCooldownTrackIds: vi.fn(),
	generateTasteSet: vi.fn(),
	createLiveGraphClient: vi.fn(),
	getConnectionStatus: vi.fn(),
	getArtist: vi.fn()
}));

vi.mock('#lib/server/taste/profile', () => ({ getTasteProfile: mocks.getTasteProfile }));
vi.mock('#lib/server/taste/cooldown', () => ({
	getGenerationCooldownTrackIds: mocks.getGenerationCooldownTrackIds
}));
vi.mock('#lib/server/taste/generate', () => ({ generateTasteSet: mocks.generateTasteSet }));
vi.mock('#lib/server/taste/graph', () => ({ createLiveGraphClient: mocks.createLiveGraphClient }));
vi.mock('#lib/server/tidal', () => ({ getConnectionStatus: mocks.getConnectionStatus }));
vi.mock('#lib/server/tidal/api', () => ({ getArtist: mocks.getArtist }));

import { actions } from './+page.server';

function event(entries: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(entries)) formData.set(key, value);
	return {
		locals: { user: { id: 'owner-1' } },
		request: new Request('http://localhost/app/generate', { method: 'POST', body: formData }),
		fetch: vi.fn(),
		cookies: {}
	} as unknown as Parameters<NonNullable<typeof actions.generate>>[0];
}

describe('/app/generate action', () => {
	beforeEach(() => {
		mocks.getTasteProfile.mockReset();
		mocks.getGenerationCooldownTrackIds.mockReset();
		mocks.generateTasteSet.mockReset();
		mocks.createLiveGraphClient.mockReset();
		mocks.getConnectionStatus.mockReset();
		mocks.getArtist.mockReset();
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getGenerationCooldownTrackIds.mockResolvedValue(new Set());
	});

	it('rejects an out-of-range form before loading the profile or expanding TIDAL', async () => {
		const result = await actions.generate?.(
			event({ targetCount: '1000', familiarity: '50', seedArtistId: '' })
		);

		expect(result).toMatchObject({
			status: 400,
			data: { errorCode: 'invalid_generation_input' }
		});
		expect(mocks.getTasteProfile).not.toHaveBeenCalled();
		expect(mocks.generateTasteSet).not.toHaveBeenCalled();
	});

	it('returns a safe connection error before reading the profile', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });

		const result = await actions.generate?.(event({ targetCount: '20', familiarity: '50' }));

		expect(result).toMatchObject({
			status: 409,
			data: { errorCode: 'generation_connection_required' }
		});
		expect(mocks.getTasteProfile).not.toHaveBeenCalled();
	});

	it('passes validated numeric knobs to the deterministic generator', async () => {
		const profile = { artists: { 'artist-1': 1 }, knobDefaults: { familiarity: 50 } };
		const set = { tracks: [], trackCount: 0 };
		const client = {};
		mocks.getTasteProfile.mockResolvedValue(profile);
		mocks.createLiveGraphClient.mockReturnValue(client);
		mocks.generateTasteSet.mockResolvedValue(set);

		const result = await actions.generate?.(
			event({ targetCount: '25', familiarity: '70', seedArtistId: 'artist-1' })
		);

		expect(result).toEqual({ success: true, set });
		expect(mocks.generateTasteSet).toHaveBeenCalledWith(profile, {
			knobs: { targetCount: 25, familiarity: 70, seedArtistId: 'artist-1', excludeExplicit: false },
			cooldownTrackIds: new Set(),
			client
		});
	});

	it('does not expose an upstream failure message', async () => {
		mocks.getTasteProfile.mockResolvedValue({ artists: { 'artist-1': 1 } });
		mocks.createLiveGraphClient.mockReturnValue({});
		mocks.generateTasteSet.mockRejectedValue(new Error('Provider response must stay server-side.'));

		const result = await actions.generate?.(event({ targetCount: '20', familiarity: '50' }));

		expect(result).toMatchObject({
			status: 502,
			data: { errorCode: 'generation_unavailable' }
		});
		expect(JSON.stringify(result)).not.toContain('Provider response');
	});
});
