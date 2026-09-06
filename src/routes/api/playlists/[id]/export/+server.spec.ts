import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getUserPlaylists: vi.fn(),
		getPlaylist: vi.fn(),
		exportBucket: { enabled: true, put: vi.fn() }
	};
});

vi.mock('#lib/server/playlists', () => ({
	getUserPlaylists: mocks.getUserPlaylists
}));

vi.mock('#lib/server/export-bucket', () => ({
	exportBucket: mocks.exportBucket
}));

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		tidalApi: {
			getPlaylist: mocks.getPlaylist
		}
	};
});

import type { Cookies } from '@sveltejs/kit';
import { GET, POST } from './+server';

const fetchMock = vi.fn();

function makeEvent(
	params: { id: string },
	url = 'https://syn.bluesix.dev/api/playlists/pl_1/export',
	user: { id: string } | null = { id: 'u1' }
) {
	return {
		locals: { user, isAdministrator: Boolean(user) },
		params,
		request: {
			url,
			json: vi.fn()
		},
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/playlists/[id]/export', () => {
	beforeEach(() => {
		mocks.getUserPlaylists.mockReset();
		mocks.getPlaylist.mockReset();
		mocks.exportBucket.put.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(
			GET(makeEvent({ id: 'pl_1' }, 'https://syn.bluesix.dev/api/playlists/pl_1/export', null))
		).rejects.toMatchObject({
			status: 401
		});
	});

	it('exports local user playlist as M3U8', async () => {
		mocks.getUserPlaylists.mockResolvedValue([
			{
				id: 'pl_1',
				userId: 'u1',
				title: 'Post-Punk Archive',
				items: [
					{
						kind: 'track',
						id: '101',
						title: 'Transmission',
						duration: 215,
						artists: [{ id: 'a1', name: 'Joy Division' }]
					}
				]
			}
		]);

		const res = await GET(
			makeEvent({ id: 'pl_1' }, 'https://syn.bluesix.dev/api/playlists/pl_1/export?format=m3u8')
		);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toContain('audio/x-mpegurl');
		expect(res.headers.get('Content-Disposition')).toContain('Post-Punk Archive.m3u8');
		const body = await res.text();
		expect(body).toContain('#EXTM3U');
		expect(body).toContain('Joy Division - Transmission');
	});

	it('exports playlist as JSON format', async () => {
		mocks.getUserPlaylists.mockResolvedValue([
			{
				id: 'pl_1',
				userId: 'u1',
				title: 'Synth Classics',
				items: [
					{
						kind: 'track',
						id: '202',
						title: 'Blue Monday',
						duration: 449,
						artists: [{ id: 'a2', name: 'New Order' }]
					}
				]
			}
		]);

		const res = await GET(
			makeEvent({ id: 'pl_1' }, 'https://syn.bluesix.dev/api/playlists/pl_1/export?format=json')
		);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toContain('application/json');
		expect(res.headers.get('Content-Disposition')).toContain('Synth Classics.json');
		const body = await res.json();
		expect(body.title).toBe('Synth Classics');
		expect(body.tracks).toHaveLength(1);
		expect(body.tracks[0].title).toBe('Blue Monday');
	});

	it('creates a short-lived bucket export behind an authenticated Syn URL', async () => {
		mocks.getUserPlaylists.mockResolvedValue([
			{
				id: 'pl_1',
				userId: 'u1',
				title: 'Synth Classics',
				items: [
					{
						kind: 'track',
						id: '202',
						title: 'Blue Monday',
						artists: [{ id: 'a2', name: 'New Order' }]
					}
				]
			}
		]);
		mocks.exportBucket.put.mockResolvedValue({
			id: '1234567890123-123e4567-e89b-12d3-a456-426614174000.m3u8',
			expiresAt: '2026-01-01T00:15:00.000Z'
		});

		const response = await POST(makeEvent({ id: 'pl_1' }) as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			downloadUrl: '/api/exports/1234567890123-123e4567-e89b-12d3-a456-426614174000.m3u8'
		});
		expect(mocks.exportBucket.put).toHaveBeenCalledWith(
			expect.objectContaining({ format: 'm3u8', fileName: 'Synth Classics.m3u8' })
		);
	});
});
