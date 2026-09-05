import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MiniPlayer from './MiniPlayer.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Bela Lugosi Is Dead',
	artists: [{ id: 'a1', name: 'Bauhaus' }],
	album: { id: 'al1', title: 'Press the Eject' }
};

afterEach(() => {
	player.currentTrack = null;
	player.isPlaying = false;
});

describe('MiniPlayer.svelte', () => {
	it('renders nothing when no track is loaded', async () => {
		player.currentTrack = null;
		render(MiniPlayer);
		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
	});

	it('shows the current track and links to Now Playing', async () => {
		player.currentTrack = track;
		render(MiniPlayer);

		await expect.element(page.getByText('Bela Lugosi Is Dead')).toBeInTheDocument();
		await expect.element(page.getByText('Bauhaus')).toBeInTheDocument();
		const link = page.getByRole('link', { name: m.now_open_full_player() });
		await expect.element(link).toBeInTheDocument();
		expect(link.element().getAttribute('href')).toBe('/now');
	});

	it('reflects the player playing state on its play/pause control', async () => {
		player.currentTrack = track;
		player.isPlaying = false;
		render(MiniPlayer);

		await expect
			.element(page.getByRole('button', { name: m.player_play_track() }))
			.toBeInTheDocument();

		player.isPlaying = true;
		await expect.element(page.getByRole('button', { name: m.player_pause() })).toBeInTheDocument();
	});
});
