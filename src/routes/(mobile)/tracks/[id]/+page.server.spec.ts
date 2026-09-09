import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getTrack: vi.fn(),
	getTrackRelationship: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: {
		getTrack: mocks.getTrack,
		getTrackRelationship: mocks.getTrackRelationship
	}
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'track-1', isAdministrator = true) {
	return {
		locals: { user: { id: 'owner' }, isAdministrator },
		params: { id },
		fetch: fetchMock,
		cookies: {}
	} as unknown as Parameters<typeof load>[0];
}

describe('/(mobile)/tracks/[id] load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getTrack.mockReset();
		mocks.getTrackRelationship.mockReset().mockResolvedValue(null);
		fetchMock.mockReset();
	});

	it('forbids a non-owner', async () => {
		await expect(load(event('track-1', false))).rejects.toMatchObject({ status: 403 });
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});

	it('returns the normalised track with its album and artist context', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getTrack.mockResolvedValue({
			data: {
				id: 'track-1',
				type: 'tracks',
				attributes: { title: 'Bela Lugosi Is Dead', duration: 559 },
				relationships: {
					albums: { data: [{ id: 'al1', type: 'albums' }] },
					artists: { data: [{ id: 'ar1', type: 'artists' }] }
				}
			},
			included: [
				{ id: 'al1', type: 'albums', attributes: { title: 'Press the Eject' } },
				{ id: 'ar1', type: 'artists', attributes: { name: 'Bauhaus' } }
			]
		});

		const result = await load(event());
		expect(result).toMatchObject({
			id: 'track-1',
			state: null,
			track: {
				id: 'track-1',
				title: 'Bela Lugosi Is Dead',
				artists: [{ id: 'ar1', name: 'Bauhaus' }],
				album: { id: 'al1', title: 'Press the Eject' }
			}
		});
	});

	it('returns not_connected without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			track: null,
			state: 'not_connected',
			id: 'track-1'
		});
		expect(mocks.getTrack).not.toHaveBeenCalled();
	});

	it('maps a 404 to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getTrack.mockRejectedValue(new TidalApiError(404, 'Not Found', null, '/tracks/track-1'));

		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', track: null });
	});
});
