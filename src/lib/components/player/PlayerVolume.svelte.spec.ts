import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlayerVolume from './PlayerVolume.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';

describe('PlayerVolume.svelte', () => {
	beforeEach(() => {
		player.isHeadroomEnabled = true;
		player.setVolume(1.0);
	});

	it('renders volume slider with 125% max headroom and percentage readout', async () => {
		render(PlayerVolume);

		const slider = page.getByRole('slider', { name: m.player_volume() });
		await expect.element(slider).toBeInTheDocument();
		await expect.element(slider).toHaveAttribute('max', '1.25');
		await expect.element(slider).toHaveAttribute('aria-valuenow', '100');

		const readout = page.getByRole('button', { name: m.player_volume_reset() });
		await expect.element(readout).toBeInTheDocument();
		await expect.element(readout).toHaveTextContent('100%');
	});

	it('toggles mute when mute button is clicked', async () => {
		render(PlayerVolume);

		const muteBtn = page.getByRole('button', { name: m.player_mute() });
		await expect.element(muteBtn).toBeInTheDocument();

		await muteBtn.click();
		expect(player.isMuted).toBe(true);

		const unmuteBtn = page.getByRole('button', { name: m.player_unmute() });
		await expect.element(unmuteBtn).toBeInTheDocument();

		await unmuteBtn.click();
		expect(player.isMuted).toBe(false);
	});

	it('displays overloudness headroom percentage when volume > 100%', async () => {
		player.setVolume(1.25);
		render(PlayerVolume);

		const readout = page.getByRole('button', { name: m.player_volume_reset() });
		await expect.element(readout).toHaveTextContent('125%');

		const slider = page.getByRole('slider', { name: m.player_volume() });
		await expect.element(slider).toHaveAttribute('aria-valuenow', '125');
	});

	it('resets volume to 100% when readout is clicked', async () => {
		player.setVolume(0.5);
		render(PlayerVolume);

		const readout = page.getByRole('button', { name: m.player_volume_reset() });
		await expect.element(readout).toHaveTextContent('50%');

		await readout.click();
		expect(player.volume).toBe(1.0);
		await expect.element(readout).toHaveTextContent('100%');
	});
});
