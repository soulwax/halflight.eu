import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlayerSeekBar from './PlayerSeekBar.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';

describe('PlayerSeekBar.svelte', () => {
	it('renders a labelled seek slider and the elapsed / total clocks', async () => {
		player.currentTime = 62;
		player.duration = 200;
		render(PlayerSeekBar);

		await expect.element(page.getByRole('slider', { name: m.player_seek() })).toBeInTheDocument();
		await expect.element(page.getByText('1:02')).toBeInTheDocument();
		await expect.element(page.getByText('3:20')).toBeInTheDocument();

		player.currentTime = 0;
		player.duration = 0;
	});
});
