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

	it('previews a drag without moving playback, then commits one seek on release', async () => {
		player.currentTime = 12;
		player.duration = 200;
		render(PlayerSeekBar);

		const slider = page.getByRole('slider', { name: m.player_seek() });
		const element = slider.element() as HTMLInputElement;

		// Every step of a drag fires `input`. None may reach the audio element:
		// each `currentTime` write can provoke a fresh Range request upstream.
		for (const value of ['60', '90', '120']) {
			element.value = value;
			element.dispatchEvent(new Event('input', { bubbles: true }));
		}
		expect(player.currentTime).toBe(12);
		await expect.element(page.getByText('2:00')).toBeInTheDocument();

		element.dispatchEvent(new Event('change', { bubbles: true }));
		expect(player.currentTime).toBe(120);

		player.currentTime = 0;
		player.duration = 0;
	});
});
