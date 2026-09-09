import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
	});

	afterEach(() => {
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

		const created = customPlaylists.playlists.find((p) => p.title === 'Post-Punk Hits');
		expect(created).toBeDefined();
		expect(created?.items).toContainEqual(sampleTrack);
	});
});
