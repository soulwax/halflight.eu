import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import { player } from '#lib/player/player.svelte.js';
import Player from './Player.svelte';

afterEach(() => {
	player.currentTrack = null;
	player.activeDevice = null;
	player.playbackClaimPending = false;
	vi.restoreAllMocks();
});

describe('Player.svelte', () => {
	it('makes an explicit desktop takeover available when another device is active', async () => {
		player.currentTrack = {
			kind: 'track',
			id: 'track-1',
			title: 'Track One',
			artists: [{ id: 'artist-1', name: 'Artist One' }]
		};
		player.activeDevice = {
			origin: 'halflight-now',
			expiresAt: new Date(Date.now() + 45_000).toISOString(),
			isCurrent: false
		};
		const playHere = vi.spyOn(player, 'playHere');

		render(Player);

		await expect.element(page.getByText(m.now_playing_elsewhere())).toBeInTheDocument();
		await page.getByRole('button', { name: m.now_play_here() }).click();
		expect(playHere).toHaveBeenCalledOnce();
	});
});
