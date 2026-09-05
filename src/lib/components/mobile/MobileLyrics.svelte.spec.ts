import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileLyrics from './MobileLyrics.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';

afterEach(() => {
	player.currentTrack = null;
	player.lyrics = null;
	player.lyricsCues = [];
	player.isLyricsLoading = false;
});

describe('MobileLyrics.svelte', () => {
	it('renders synchronized lyrics as seekable lines', async () => {
		player.currentTrack = { kind: 'track', id: 'track', title: 'A song', artists: [] };
		player.lyricsCues = [{ time: 42, text: 'The right line' }];
		render(MobileLyrics);

		await page.getByRole('button', { name: /The right line/ }).click();
		expect(player.currentTime).toBe(42);
		await expect
			.element(page.getByRole('link', { name: m.now_lyrics_back() }))
			.toHaveAttribute('href', '/now');
	});

	it('explains when lyrics are unavailable', async () => {
		player.currentTrack = { kind: 'track', id: 'track', title: 'A song', artists: [] };
		render(MobileLyrics);
		await expect.element(page.getByText(m.player_no_lyrics())).toBeInTheDocument();
	});
});
