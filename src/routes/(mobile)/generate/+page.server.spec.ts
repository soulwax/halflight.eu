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

import { actions, load } from './+page.server';

function event(entries: Record<string, string> = {}) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(entries)) formData.set(key, value);
	return {
		locals: { user: { id: 'owner-1' }, isListener: true },
		request: new Request('http://localhost/generate', { method: 'POST', body: formData }),
		fetch: vi.fn(),
		cookies: {}
	} as never;
}

describe('/(mobile)/generate', () => {
	beforeEach(() => {
		Object.values(mocks).forEach((mock) => mock.mockReset());
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getGenerationCooldownTrackIds.mockResolvedValue(new Set());
	});

	it('offers only the three strongest profile anchors as mobile seed options', async () => {
		mocks.getTasteProfile.mockResolvedValue({
			artists: { low: 0.1, middle: 0.5, high: 1, next: 0.75 },
			knobDefaults: {}
		});
		mocks.getArtist.mockImplementation(async (id: string) => ({
			data: { attributes: { name: id } }
		}));

		const result = await load(event() as Parameters<typeof load>[0]);

		expect(result).toMatchObject({
			seedArtists: [{ id: 'high' }, { id: 'next' }, { id: 'middle' }]
		});
		expect(mocks.getArtist).toHaveBeenCalledTimes(3);
	});

	it('generates from validated concise controls without exposing an upstream failure', async () => {
		const profile = { artists: { 'artist-1': 1 }, knobDefaults: {} };
		const client = {};
		const set = { tracks: [], trackCount: 0 };
		mocks.getTasteProfile.mockResolvedValue(profile);
		mocks.createLiveGraphClient.mockReturnValue(client);
		mocks.generateTasteSet.mockResolvedValue(set);

		const result = await actions.generate?.(
			event({ targetCount: '15', familiarity: '25', seedArtistId: 'artist-1' }) as never
		);

		expect(result).toEqual({ success: true, set });
		expect(mocks.generateTasteSet).toHaveBeenCalledWith(profile, {
			knobs: { targetCount: 15, familiarity: 25, seedArtistId: 'artist-1', excludeExplicit: false },
			cooldownTrackIds: new Set(),
			client
		});
	});

	it('keeps the error safe when the generator fails', async () => {
		mocks.getTasteProfile.mockResolvedValue({ artists: { 'artist-1': 1 }, knobDefaults: {} });
		mocks.createLiveGraphClient.mockReturnValue({});
		mocks.generateTasteSet.mockRejectedValue(new Error('upstream credentials'));

		const result = await actions.generate?.(
			event({ targetCount: '20', familiarity: '50' }) as never
		);

		expect(result).toMatchObject({ status: 502, data: { errorCode: 'generation_unavailable' } });
		expect(JSON.stringify(result)).not.toContain('credentials');
	});
});
