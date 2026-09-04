import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlayerTransport from './PlayerTransport.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';

describe('PlayerTransport.svelte', () => {
	it('exposes shuffle, previous, play, next and repeat controls', async () => {
		render(PlayerTransport);
		for (const name of [
			m.player_shuffle(),
			m.player_previous(),
			m.player_next(),
			m.player_repeat()
		]) {
			await expect.element(page.getByRole('button', { name })).toBeInTheDocument();
		}
	});

	it('toggles shuffle state through the player when clicked', async () => {
		player.shuffle = false;
		render(PlayerTransport);
		await page.getByRole('button', { name: m.player_shuffle() }).click();
		expect(player.shuffle).toBe(true);
		player.shuffle = false;
	});
});
