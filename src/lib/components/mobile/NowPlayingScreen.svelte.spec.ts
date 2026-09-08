import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NowPlayingScreen from './NowPlayingScreen.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Bela Lugosi Is Dead',
	duration: 542,
	artists: [{ id: 'a1', name: 'Bauhaus' }],
	album: {
		id: 'al1',
		title: 'Press the Eject',
		releaseDate: '1982-01-01',
		imageUrl: 'https://img.test/cover.jpg'
	}
};

afterEach(() => {
	player.currentTrack = null;
	player.queue = [];
	player.history = [];
	player.currentTime = 0;
	player.duration = 0;
	player.isPlaying = false;
	player.shuffle = false;
	player.repeatMode = 'off';
	player.activeDevice = null;
	player.playbackClaimPending = false;
});

describe('NowPlayingScreen.svelte', () => {
	it('shows an honest idle state with no track loaded', async () => {
		player.currentTrack = null;
		await render(NowPlayingScreen);

		await expect.element(page.getByText(m.now_idle_message())).toBeInTheDocument();
		const cta = page.getByRole('link', { name: m.now_idle_cta() });
		await expect.element(cta).toBeInTheDocument();
		expect(cta.element().getAttribute('href')).toBe('/home');
	});

	it('shows artwork, identity, seek control and transport for the current track', async () => {
		player.currentTrack = track;
		await render(NowPlayingScreen);

		await expect
			.element(page.getByRole('img', { name: 'Cover for Bela Lugosi Is Dead' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Bela Lugosi Is Dead')).toBeInTheDocument();
		await expect.element(page.getByText('Bauhaus')).toBeInTheDocument();
		await expect.element(page.getByText('Press the Eject · 1982')).toBeInTheDocument();
		await expect.element(page.getByRole('slider', { name: m.player_seek() })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_previous() }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: m.player_next() })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_play_track() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_lyrics_open() }))
			.toHaveAttribute('href', '/now/lyrics');
		await expect
			.element(page.getByRole('link', { name: m.now_close_player() }))
			.toHaveAttribute('href', '/home');
	});

	it('disables previous/next when there is nowhere to go', async () => {
		player.currentTrack = track;
		player.queue = [];
		player.history = [];
		player.currentTime = 0;
		await render(NowPlayingScreen);

		expect(
			page.getByRole('button', { name: m.player_previous() }).element().hasAttribute('disabled')
		).toBe(true);
		expect(
			page.getByRole('button', { name: m.player_next() }).element().hasAttribute('disabled')
		).toBe(true);
	});

	it('offers an explicit takeover without claiming playback on mount', async () => {
		player.currentTrack = track;
		player.activeDevice = {
			origin: 'listening-room',
			expiresAt: new Date(Date.now() + 45_000).toISOString(),
			isCurrent: false
		};
		await render(NowPlayingScreen);

		await expect.element(page.getByText(m.now_playing_elsewhere())).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: m.now_play_here() })).toBeInTheDocument();
		expect(player.playbackClaimPending).toBe(false);
	});

	it('toggles shuffle and cycles repeat from the transport', async () => {
		player.currentTrack = track;
		player.shuffle = false;
		player.repeatMode = 'off';
		await render(NowPlayingScreen);

		const shuffle = page.getByRole('button', { name: m.player_shuffle() });
		await expect.element(shuffle).toHaveAttribute('aria-pressed', 'false');
		await shuffle.click();
		expect(player.shuffle).toBe(true);
		await expect.element(shuffle).toHaveAttribute('aria-pressed', 'true');

		const repeat = page.getByRole('button', { name: m.player_repeat() });
		await repeat.click();
		expect(player.repeatMode).toBe('all');
		await repeat.click();
		expect(player.repeatMode).toBe('one');
		await expect.element(repeat).toHaveAttribute('aria-pressed', 'true');
	});

	it('previews a scrub before committing one deliberate seek', async () => {
		player.currentTrack = track;
		player.duration = track.duration ?? 0;
		player.currentTime = 12;
		render(NowPlayingScreen);
		const slider = page.getByRole('slider', { name: m.player_seek() });
		const element = slider.element() as HTMLInputElement;
		element.value = '120';
		element.dispatchEvent(new Event('input', { bubbles: true }));

		expect(player.currentTime).toBe(12);
		await expect.element(page.getByText('2:00')).toBeInTheDocument();

		element.dispatchEvent(new Event('change', { bubbles: true }));
		expect(player.currentTime).toBe(120);
	});

	it('discards a scrub preview when playback advances to another track', async () => {
		player.currentTrack = track;
		player.duration = track.duration ?? 0;
		player.currentTime = 12;
		render(NowPlayingScreen);
		const slider = page.getByRole('slider', { name: m.player_seek() });
		const element = slider.element() as HTMLInputElement;
		element.value = '120';
		element.dispatchEvent(new Event('input', { bubbles: true }));
		await expect.element(page.getByText('2:00')).toBeInTheDocument();

		player.currentTrack = { ...track, id: '10', title: 'Stigmata Martyr', duration: 203 };
		player.duration = 203;
		player.currentTime = 8;

		await expect.element(slider).toHaveValue('8');
		await expect.element(page.getByText('0:08')).toBeInTheDocument();
	});
});
