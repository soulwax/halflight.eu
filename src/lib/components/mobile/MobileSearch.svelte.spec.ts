import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import { player } from '#lib/player/player.svelte.js';
import MobileSearch from './MobileSearch.svelte';

afterEach(() => {
	vi.unstubAllGlobals();
	player.currentTrack = null;
	player.queue = [];
	player.history = [];
});

describe('MobileSearch.svelte', () => {
	it('keeps newer results when an older mobile query resolves late', async () => {
		const pending: Array<{ resolve: (response: Response) => void }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						pending.push({ resolve });
					})
			)
		);
		render(MobileSearch);

		const input = page.getByRole('searchbox', { name: 'Search your music' });
		await input.fill('first');
		await expect.poll(() => pending.length).toBe(1);
		await input.fill('second');
		await expect.poll(() => pending.length).toBe(2);

		pending[1]?.resolve(
			new Response(
				JSON.stringify({
					results: {
						tracks: [{ kind: 'track', id: 'second', title: 'Second result', artists: [] }],
						albums: [],
						artists: [],
						playlists: []
					}
				})
			)
		);
		await expect.element(page.getByText('Second result')).toBeInTheDocument();

		pending[0]?.resolve(
			new Response(
				JSON.stringify({
					results: {
						tracks: [{ kind: 'track', id: 'first', title: 'First result', artists: [] }],
						albums: [],
						artists: [],
						playlists: []
					}
				})
			)
		);
		await expect.element(page.getByText('First result')).not.toBeInTheDocument();
	});

	it('shows every queue verb for a track result', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						results: {
							tracks: [
								{
									kind: 'track',
									id: 'track-1',
									title: 'Mobile Track',
									artists: [{ id: 'artist-1', name: 'Mobile Artist' }]
								}
							],
							albums: [],
							artists: [],
							playlists: []
						}
					})
				)
			)
		);
		render(MobileSearch);

		const input = page.getByRole('searchbox', { name: 'Search your music' });
		await input.fill('mobile');
		await expect.element(page.getByText('Mobile Track')).toBeInTheDocument();

		await expect
			.element(page.getByRole('button', { name: m.player_play_track(), exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_play_next(), exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_add_to_queue(), exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_start_radio(), exact: true }))
			.toBeInTheDocument();
	});
});
