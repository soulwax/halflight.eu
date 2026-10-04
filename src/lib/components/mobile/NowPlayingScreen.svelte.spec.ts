import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
		imageUrl:
			'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="slateblue"/%3E%3C/svg%3E'
	}
};

beforeEach(() => {
	player.isLoading = false;
	player.playbackMode = 'direct';
	player.activeDevice = null;
});
afterEach(() => {
	player.currentTrack = null;
	player.queue = [];
	player.history = [];
	player.currentTime = 0;
	player.duration = 0;
	player.isPlaying = false;
	player.isLoading = false;
	player.playbackMode = 'direct';
	player.persistenceStatus = 'saved';
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
		await expect.element(page.getByText(m.now_idle_description())).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_idle_search() }))
			.toHaveAttribute('href', '/search');
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

		const repeat = page.getByRole('button', { name: m.player_repeat_off() });
		await repeat.click();
		expect(player.repeatMode).toBe('all');
		await page.getByRole('button', { name: m.player_repeat_all() }).click();
		expect(player.repeatMode).toBe('one');
		await expect
			.element(page.getByRole('button', { name: m.player_repeat_one() }))
			.toHaveAttribute('aria-pressed', 'true');
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

describe('mobile Now layout and recovery', () => {
	it('keeps five transport targets within a 320px viewport', async () => {
		await page.viewport(320, 640);
		player.currentTrack = {
			...track,
			title: 'A very long track title that should wrap without pushing the controls out of view'
		};
		await render(NowPlayingScreen);
		const play = page.getByRole('button', { name: m.player_play_track() });
		await expect.element(play).toBeInTheDocument();
		for (const name of [
			m.player_shuffle(),
			m.player_previous(),
			m.player_play_track(),
			m.player_next(),
			m.player_repeat_off()
		]) {
			const rect = page.getByRole('button', { name }).element().getBoundingClientRect();
			expect(rect.width).toBeGreaterThanOrEqual(name === m.player_play_track() ? 64 : 48);
			expect(rect.height).toBeGreaterThanOrEqual(48);
			expect(rect.left).toBeGreaterThanOrEqual(0);
			expect(rect.right).toBeLessThanOrEqual(320);
			expect(rect.top).toBeGreaterThanOrEqual(0);
			expect(rect.bottom).toBeLessThanOrEqual(640);
		}
		const screen = document.querySelector('.now-screen');
		expect(screen?.scrollHeight).toBeLessThanOrEqual(640);
		expect(screen?.scrollWidth).toBeLessThanOrEqual(320);
		await page.viewport(1280, 900);
	});
	it.each([
		{ width: 375, height: 667 },
		{ width: 390, height: 844 }
	])(
		'fits completely within mobile viewport $width×$height with zero vertical or horizontal overflow',
		async ({ width, height }) => {
			await page.viewport(width, height);
			player.currentTrack = track;
			player.duration = 542;
			player.currentTime = 84;
			await render(NowPlayingScreen);

			const closeBtn = page.getByRole('link', { name: m.now_close_player() });
			const closeRect = closeBtn.element().getBoundingClientRect();
			expect(closeRect.top).toBeGreaterThanOrEqual(0);

			for (const name of [
				m.player_shuffle(),
				m.player_previous(),
				m.player_play_track(),
				m.player_next(),
				m.player_repeat_off()
			]) {
				const rect = page.getByRole('button', { name }).element().getBoundingClientRect();
				expect(rect.top).toBeGreaterThanOrEqual(0);
				expect(rect.bottom).toBeLessThanOrEqual(height);
				expect(rect.left).toBeGreaterThanOrEqual(0);
				expect(rect.right).toBeLessThanOrEqual(width);
			}

			for (const linkName of [m.now_queue_open(), m.now_lyrics_open(), m.now_credits_title()]) {
				const linkRect = page
					.getByRole('link', { name: linkName })
					.element()
					.getBoundingClientRect();
				expect(linkRect.bottom).toBeLessThanOrEqual(height);
			}

			const screen = document.querySelector('.now-screen');
			expect(screen?.scrollHeight).toBeLessThanOrEqual(height);
			expect(screen?.scrollWidth).toBeLessThanOrEqual(width);
			await page.viewport(1280, 900);
		}
	);
	it('shows a safe TIDAL destination with direct seek and play unavailable in fallback', async () => {
		player.currentTrack = track;
		player.playbackMode = 'embed';
		player.duration = 200;
		player.requiresFullAuth = false;
		await render(NowPlayingScreen);
		await expect.element(page.getByRole('button', { name: m.player_play_track() })).toBeDisabled();
		await expect.element(page.getByRole('slider', { name: m.player_seek() })).toBeDisabled();
		await expect
			.element(page.getByRole('link', { name: m.action_open_in_tidal() }))
			.toHaveAttribute('href', 'https://tidal.com/browse/track/9');
		expect(player.currentTrack?.id).toBe('9');
	});
});
