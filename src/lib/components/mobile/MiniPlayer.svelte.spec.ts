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
	player.currentTime = 0;
	player.duration = 0;
	player.persistenceStatus = 'saved';
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

	it('reflects elapsed progress as the width of a decorative bar', async () => {
		player.currentTrack = track;
		player.duration = 240;
		player.currentTime = 60;
		const { container } = render(MiniPlayer);

		const fill = container.querySelector<HTMLElement>('.mini-progress-fill');
		expect(fill).not.toBeNull();
		expect(fill?.style.width).toBe('25%');

		player.currentTime = 120;
		await expect.poll(() => fill?.style.width).toBe('50%');
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

	it('keeps track and transport space stable while queue recovery lives in the shell', async () => {
		player.currentTrack = track;
		player.persistenceStatus = 'saved';
		const { container } = render(MiniPlayer);
		container.style.width = '320px';
		const link = page.getByRole('link', { name: m.now_open_full_player() });
		await expect.element(link).toBeInTheDocument();
		const width = link.element().getBoundingClientRect().width;
		player.persistenceStatus = 'offline';
		await expect
			.element(page.getByRole('button', { name: m.player_sync_local() }))
			.not.toBeInTheDocument();
		expect(link.element().getBoundingClientRect().width).toBe(width);
	});
});
