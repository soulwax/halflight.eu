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
	player.persistenceStatus = 'saved';
	vi.restoreAllMocks();
});

describe('Player.svelte', () => {
	it('opens Now Playing from the song identity without leaving the current page', async () => {
		player.currentTrack = {
			kind: 'track',
			id: 'track-1',
			title: 'Track One',
			artists: [{ id: 'artist-1', name: 'Artist One' }]
		};
		player.isExpanded = false;
		render(Player);
		await page.getByRole('button', { name: m.player_now_playing() }).click();
		await expect.element(page.getByRole('tab', { name: /queue/i })).toBeInTheDocument();
		expect(player.isExpanded).toBe(true);
	});
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

	it('offers save recovery through the status icon without inline warning text', async () => {
		player.currentTrack = {
			kind: 'track',
			id: 'track-1',
			title: 'Track One',
			artists: [{ id: 'artist-1', name: 'Artist One' }]
		};
		player.persistenceStatus = 'server_error';
		const retry = vi.spyOn(player, 'retryPersistence');

		render(Player);

		await expect.element(page.getByText(m.player_sync_local())).not.toBeInTheDocument();
		await page.getByRole('button', { name: m.player_sync_local() }).click();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await page.getByRole('button', { name: m.player_sync_retry() }).click();
		expect(retry).toHaveBeenCalledOnce();
	});
});
it('minimises the expanded scaffold with Escape while keeping the current song', async () => {
	player.currentTrack = { kind: 'track', id: '42', title: 'Song', artists: [] };
	player.isExpanded = true;
	render(Player);
	document.body.dispatchEvent(
		new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true })
	);
	expect(player.isExpanded).toBe(false);
	expect(player.currentTrack?.id).toBe('42');
});
