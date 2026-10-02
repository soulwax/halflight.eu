import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	readRecord: vi.fn(),
	readPlaybackRecord: vi.fn()
}));

vi.mock('#lib/server/tidal/store.js', () => ({
	readRecord: mocks.readRecord,
	readPlaybackRecord: mocks.readPlaybackRecord
}));

import { GET } from './+server';

function event(user: { id: string } | null = { id: 'owner' }, isAdministrator = true) {
	return { locals: { user, isAdministrator } } as unknown as Parameters<typeof GET>[0];
}

const browseRecord = {
	accessToken: 'browse-access-secret',
	refreshToken: 'browse-refresh-secret',
	tokenType: 'Bearer',
	scope: ['user.read', 'search.read'],
	expiresAt: Date.now() + 60_000,
	obtainedAt: Date.now(),
	userId: 'tidal-user'
};

describe('GET /api/tidal/debug-tokens', () => {
	beforeEach(() => {
		mocks.readRecord.mockReset();
		mocks.readPlaybackRecord.mockReset();
	});

	it('requires the signed-in administrator before reading token records', async () => {
		const response = await GET(event({ id: 'other' }, false));

		expect(response.status).toBe(401);
		expect(mocks.readRecord).not.toHaveBeenCalled();
		expect(response.headers.get('cache-control')).toContain('no-store');
	});

	it('returns only the current owner token records with strict no-store headers', async () => {
		mocks.readRecord.mockResolvedValue(browseRecord);
		mocks.readPlaybackRecord.mockResolvedValue({
			...browseRecord,
			accessToken: 'playback-access-secret',
			refreshToken: 'playback-refresh-secret',
			scope: ['r_usr']
		});

		const response = await GET(event());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toContain('no-store');
		expect(response.headers.get('vary')).toBe('Cookie');
		expect(body).toMatchObject({
			browse: {
				accessToken: 'browse-access-secret',
				refreshToken: 'browse-refresh-secret',
				scopes: ['user.read', 'search.read']
			},
			playback: {
				accessToken: 'playback-access-secret',
				refreshToken: 'playback-refresh-secret',
				scopes: ['r_usr']
			}
		});
		expect(body.browse.userId).toBeUndefined();
		expect(body.browse.obtainedAt).toBeUndefined();
	});

	it('does not return storage or decryption errors', async () => {
		mocks.readRecord.mockRejectedValue(new Error('private database and key detail'));
		mocks.readPlaybackRecord.mockResolvedValue(null);

		const response = await GET(event());

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'token_records_unavailable' });
	});
});
