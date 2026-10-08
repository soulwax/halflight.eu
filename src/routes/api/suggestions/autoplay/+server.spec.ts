import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
	connection: vi.fn(),
	relationship: vi.fn(),
	preferences: vi.fn(),
	profile: vi.fn()
}));
vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.connection,
	tidalApi: { getTrackRelationship: mocks.relationship },
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));
vi.mock('#lib/server/listening-preferences', () => ({
	getListeningPreferences: mocks.preferences
}));
vi.mock('#lib/server/taste/profile', () => ({ getTasteProfile: mocks.profile }));
import { POST } from './+server';

function event(body: unknown, user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user, isListener: true },
		request: new Request('http://localhost/api/suggestions/autoplay', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		fetch: vi.fn(),
		cookies: {} as Cookies
	} as unknown as Parameters<typeof POST>[0];
}

const radio = {
	data: Array.from({ length: 12 }, (_, i) => ({
		id: String(200 + i),
		type: 'tracks',
		attributes: { title: `Song ${i}` },
		relationships: { artists: { data: [{ id: `artist-${i}`, type: 'artists' }] } }
	})),
	included: Array.from({ length: 12 }, (_, i) => ({
		id: `artist-${i}`,
		type: 'artists',
		attributes: { name: `Artist ${i}` }
	}))
};
const preferences = {
	autoplay: true,
	autoplayCount: 10,
	personalizeSuggestions: false,
	learnFromListening: true,
	useLastfmHistory: true
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.connection.mockResolvedValue({ connected: true });
	mocks.relationship.mockResolvedValue(radio);
	mocks.preferences.mockResolvedValue(preferences);
	mocks.profile.mockResolvedValue({
		artists: {},
		exclusions: { artists: [], eras: [] },
		overrides: { artists: {} }
	});
});

describe('POST /api/suggestions/autoplay', () => {
	it('rejects unauthenticated requests', async () => {
		await expect(POST(event({ seeds: [{ id: '1' }] }, null))).rejects.toMatchObject({
			status: 401
		});
	});

	it.each([
		{},
		{ seeds: [] },
		{ seeds: [{ id: 'not-a-track' }] },
		{ seeds: [{ id: '1' }], exclude: 'x' }
	])('rejects a malformed body %#', async (body) => {
		await expect(POST(event(body))).rejects.toMatchObject({ status: 400 });
	});

	it('returns the saved number of songs, excluding what the session already has', async () => {
		const response = await POST(event({ seeds: [{ id: '1' }], exclude: [{ id: '200' }] }));
		const { tracks } = await response.json();
		expect(tracks).toHaveLength(10);
		expect(tracks.map((t: { id: string }) => t.id)).not.toContain('200');
		expect(mocks.profile).not.toHaveBeenCalled();
	});

	it('does nothing upstream when autoplay is switched off', async () => {
		mocks.preferences.mockResolvedValue({ ...preferences, autoplay: false });
		const response = await POST(event({ seeds: [{ id: '1' }] }));
		expect(await response.json()).toEqual({ tracks: [], reason: 'autoplay_disabled' });
		expect(mocks.relationship).not.toHaveBeenCalled();
	});

	it('uses the taste profile only when the listener allows it', async () => {
		mocks.preferences.mockResolvedValue({ ...preferences, personalizeSuggestions: true });
		await POST(event({ seeds: [{ id: '1' }] }));
		expect(mocks.profile).toHaveBeenCalledWith('u1');
	});

	it('falls back to similar tracks when radio is unavailable', async () => {
		mocks.relationship.mockRejectedValueOnce(new Error('no radio')).mockResolvedValueOnce(radio);
		const response = await POST(event({ seeds: [{ id: '1' }] }));
		expect((await response.json()).tracks).toHaveLength(10);
		expect(mocks.relationship).toHaveBeenLastCalledWith(
			'1',
			'similarTracks',
			expect.anything(),
			expect.anything()
		);
	});
});
