import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getTasteProfile: vi.fn(),
	refreshTasteProfile: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({ getConnectionStatus: mocks.getConnectionStatus }));
vi.mock('#lib/server/taste/profile', () => ({
	getTasteProfile: mocks.getTasteProfile,
	refreshTasteProfile: mocks.refreshTasteProfile
}));

import { GET, POST } from './+server';

const profile = {
	version: 1,
	artists: {},
	eras: {},
	exclusions: { artists: [], eras: [] },
	overrides: { artists: {} },
	knobDefaults: { familiarity: 50 },
	confidence: { artists: 0, eras: 0 },
	updatedAt: '2026-09-04T00:00:00.000Z'
};

function eventFor(user = true, isAdministrator = true): Parameters<typeof GET>[0] {
	return {
		locals: user ? { user: { id: 'owner-1' }, isAdministrator } : { isAdministrator: false },
		fetch: vi.fn(),
		cookies: {}
	} as unknown as Parameters<typeof GET>[0];
}

describe('/api/taste/profile', () => {
	it('rejects signed-in non-owners', async () => {
		await expect(GET(eventFor(true, false))).rejects.toMatchObject({ status: 401 });
	});

	it('returns only the signed-in owner profile', async () => {
		mocks.getTasteProfile.mockResolvedValue(profile);

		const response = await GET(eventFor());

		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual(profile);
		expect(mocks.getTasteProfile).toHaveBeenCalledWith('owner-1');
	});

	it('requires a TIDAL connection before rebuilding', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });

		await expect(POST(eventFor())).rejects.toMatchObject({ status: 409 });
		expect(mocks.refreshTasteProfile).not.toHaveBeenCalled();
	});

	it('rebuilds using the request-scoped server context', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.refreshTasteProfile.mockResolvedValue(profile);
		const event = eventFor();

		const response = await POST(event);

		expect(await response.json()).toEqual(profile);
		expect(mocks.refreshTasteProfile).toHaveBeenCalledWith(
			'owner-1',
			expect.objectContaining({ ctx: expect.objectContaining({ fetch: event.fetch }) })
		);
	});
});
