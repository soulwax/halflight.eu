import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlaylistDialog from './PlaylistDialog.svelte';
import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const sampleTrack: TrackSummary = {
	kind: 'track',
	id: 'trk-1',
	title: 'Blue Monday',
	artists: [{ id: 'art-1', name: 'New Order' }],
	duration: 449
};

describe('PlaylistDialog.svelte', () => {
	beforeEach(() => {
		customPlaylists.closeAddToPlaylist();
		customPlaylists.playlists = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				const body = JSON.parse(String(init?.body || '{}')) as {
					id?: string;
					title?: string;
					items?: TrackSummary[];
				};
				return Response.json({
					playlist: {
						id: body.id || customPlaylists.playlists[0]?.id || 'saved',
						title: body.title || 'Synth Classics',
						items: body.items || [],
						createdAt: '2026-10-02',
						updatedAt: '2026-10-02'
					}
				});
			})
		);
	});

	afterEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.reject(new Error('fetch disabled in component tests')))
		);
		customPlaylists.closeAddToPlaylist();
	});

	it('renders dialog when track is selected for playlist', async () => {
		customPlaylists.promptAddToPlaylist(sampleTrack);
		render(PlaylistDialog);

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Blue Monday')).toBeInTheDocument();
		await expect.element(page.getByText('New Order')).toBeInTheDocument();
	});

	it('allows adding to an existing playlist', async () => {
		customPlaylists.createPlaylist('Synth Classics', undefined, []);
		customPlaylists.promptAddToPlaylist(sampleTrack);
		render(PlaylistDialog);

		await expect.element(page.getByText('Synth Classics')).toBeInTheDocument();
		const addBtn = page.getByRole('button', { name: m.playlist_dialog_add(), exact: true });
		await expect.element(addBtn).toBeInTheDocument();
		await addBtn.click();

		await expect
			.element(page.getByRole('button', { name: m.playlist_dialog_added() }))
			.toBeInTheDocument();
		expect(customPlaylists.playlists[0]?.items).toContainEqual(sampleTrack);
	});

	it('allows creating a new playlist with the selected track', async () => {
		customPlaylists.promptAddToPlaylist(sampleTrack);
		render(PlaylistDialog);

		const input = page.getByPlaceholder(m.playlist_dialog_create_placeholder());
		await expect.element(input).toBeInTheDocument();
		await input.fill('Post-Punk Hits');

		const submitBtn = page.getByRole('button', { name: m.playlist_dialog_create_action() });
		await expect.element(submitBtn).toBeEnabled();
		await submitBtn.click();

		await expect.element(page.getByText('Post-Punk Hits', { exact: true })).toBeInTheDocument();
		const created = customPlaylists.playlists.find((p) => p.title === 'Post-Punk Hits');
		expect(created).toBeDefined();
		expect(created?.items).toContainEqual(sampleTrack);
	});
});

describe('playlist save failure', () => {
	it('keeps the entered name and selected track after a server failure', async () => {
		customPlaylists.playlists = [];
		customPlaylists.promptAddToPlaylist(sampleTrack);
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(new Response(null, { status: 503 })))
		);
		await render(PlaylistDialog);
		await page.getByPlaceholder(m.playlist_dialog_create_placeholder()).fill('Keep this name');
		await page.getByRole('button', { name: m.playlist_dialog_create_action() }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.player_queue_save_error());
		await expect
			.element(page.getByPlaceholder(m.playlist_dialog_create_placeholder()))
			.toHaveValue('Keep this name');
		expect(customPlaylists.playlists).toEqual([]);
		expect(customPlaylists.selectedTrackForPlaylist?.id).toBe(sampleTrack.id);
		customPlaylists.closeAddToPlaylist();
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.reject(new Error('fetch disabled in component tests')))
		);
	});
});
