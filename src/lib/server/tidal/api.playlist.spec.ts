import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	updatePlaylist,
	deletePlaylistRemote,
	removePlaylistItems,
	replacePlaylistItems
} from './api';
import { tidalJson, getAccessToken } from './client';
import { TidalApiError } from './errors';
import { TIDAL_API_BASE } from './config';

vi.mock('./client', () => ({
	tidalJson: vi.fn(),
	tidalFetch: vi.fn(),
	getAccessToken: vi.fn()
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('TIDAL playlist API wrappers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockReset();
	});

	it('updatePlaylist sends PATCH with correct JSON:API body', async () => {
		expect.assertions(1);
		vi.mocked(tidalJson).mockResolvedValue({ data: { id: 'p1' } } as any);

		await updatePlaylist('p1', { title: 'New Title', description: 'Desc' });

		expect(tidalJson).toHaveBeenCalledWith(
			'/playlists/p1',
			{
				method: 'PATCH',
				body: JSON.stringify({
					data: {
						type: 'playlists',
						id: 'p1',
						attributes: { title: 'New Title', description: 'Desc' }
					}
				})
			},
			undefined
		);
	});

	it('deletePlaylistRemote sends DELETE and handles 204 no-content', async () => {
		expect.assertions(2);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve('')
		});

		await deletePlaylistRemote('p1');

		expect(getAccessToken).toHaveBeenCalled();
		expect(mockFetch).toHaveBeenCalledWith(`${TIDAL_API_BASE}/playlists/p1`, {
			method: 'DELETE',
			headers: {
				authorization: 'Bearer token123',
				'content-type': 'application/vnd.api+json'
			}
		});
	});

	it('deletePlaylistRemote throws TidalApiError on non-ok responses', async () => {
		expect.assertions(1);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
			text: () => Promise.resolve('err')
		});

		await expect(deletePlaylistRemote('p1')).rejects.toThrow(TidalApiError);
	});

	it('removePlaylistItems chunks >50 items into multiple DELETE calls', async () => {
		expect.assertions(3);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve('')
		});

		const items = Array.from({ length: 120 }, (_, i) => ({ id: `t${i}` }));
		await removePlaylistItems('p1', items);

		expect(mockFetch).toHaveBeenCalledTimes(3); // 50, 50, 20
		expect(mockFetch).toHaveBeenNthCalledWith(
			1,
			`${TIDAL_API_BASE}/playlists/p1/relationships/items`,
			expect.objectContaining({ method: 'DELETE' })
		);
		expect(mockFetch).toHaveBeenNthCalledWith(
			3,
			`${TIDAL_API_BASE}/playlists/p1/relationships/items`,
			expect.objectContaining({ method: 'DELETE' })
		);
	});

	it('replacePlaylistItems sends PUT with correct JSON:API body', async () => {
		expect.assertions(2);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve('')
		});

		await replacePlaylistItems('p1', [{ id: 't1' }, { id: 'v1', type: 'videos' }]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(`${TIDAL_API_BASE}/playlists/p1/relationships/items`, {
			method: 'PUT',
			headers: {
				authorization: 'Bearer token123',
				'content-type': 'application/vnd.api+json'
			},
			body: JSON.stringify({
				data: [
					{ id: 't1', type: 'tracks' },
					{ id: 'v1', type: 'videos' }
				]
			})
		});
	});
});
