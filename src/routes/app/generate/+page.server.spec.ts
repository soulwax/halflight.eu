import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getTasteProfile: vi.fn(),
	generateTasteSet: vi.fn(),
	createLiveGraphClient: vi.fn(),
	getConnectionStatus: vi.fn(),
	getArtist: vi.fn()
}));

vi.mock('#lib/server/taste/profile', () => ({ getTasteProfile: mocks.getTasteProfile }));
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
		mocks.generateTasteSet.mockReset();
		mocks.createLiveGraphClient.mockReset();
		mocks.getConnectionStatus.mockReset();
		mocks.getArtist.mockReset();
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
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
			knobs: { targetCount: 25, familiarity: 70, seedArtistId: 'artist-1' },
			client
		});
	});
});
