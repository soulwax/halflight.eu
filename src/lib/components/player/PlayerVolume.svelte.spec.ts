import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
		await render(PlayerVolume);

		const slider = page.getByRole('slider', { name: m.player_volume() });
		await expect.element(slider).toBeInTheDocument();
		await expect.element(slider).toHaveAttribute('max', '1.25');
		await expect.element(slider).toHaveAttribute('aria-valuenow', '100');

		const readout = page.getByRole('button', { name: m.player_volume_reset() });
		await expect.element(readout).toBeInTheDocument();
		await expect.element(readout).toHaveTextContent('100%');
	});

	it('toggles mute when mute button is clicked', async () => {
		await render(PlayerVolume);

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
		await render(PlayerVolume);

		const readout = page.getByRole('button', { name: m.player_volume_reset() });
		await expect.element(readout).toHaveTextContent('125%');

		const slider = page.getByRole('slider', { name: m.player_volume() });
		await expect.element(slider).toHaveAttribute('aria-valuenow', '125');
	});

	it('resets volume to 100% when readout is clicked', async () => {
		player.setVolume(0.5);
		await render(PlayerVolume);

		const readout = page.getByRole('button', { name: m.player_volume_reset() });
		await expect.element(readout).toHaveTextContent('50%');

		await readout.click();
		expect(player.volume).toBe(1.0);
		await expect.element(readout).toHaveTextContent('100%');
	});

	it('adjusts volume when slider is clicked with mouse', async () => {
		player.setVolume(1.0);
		await render(PlayerVolume);

		const slider = page.getByRole('slider', { name: m.player_volume() });
		await slider.click({ position: { x: 10, y: 7 } });
		expect(player.volume).not.toBe(1.0);
	});

	it('adjusts volume via keyboard arrow keys, home, end, and 1', async () => {
		player.setVolume(1.0);
		await render(PlayerVolume);

		const slider = page.getByRole('slider', { name: m.player_volume() });
		const el = slider.element();

		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		expect(player.volume).toBeCloseTo(0.95, 2);

		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		expect(player.volume).toBeCloseTo(1.0, 2);

		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		expect(player.volume).toBe(0);

		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		expect(player.volume).toBe(1.25);

		el.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
		expect(player.volume).toBe(1.0);
	});

	it('resets volume to 100% on double click', async () => {
		player.setVolume(0.5);
		await render(PlayerVolume);

		const slider = page.getByRole('slider', { name: m.player_volume() });
		slider.element().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(player.volume).toBe(1.0);
	});

	it('smoothly updates volume when dragged with pointer', async () => {
		player.setVolume(1.0);
		await render(PlayerVolume);

		const track = document.querySelector('.vol-track') as HTMLElement;
		expect(track).not.toBeNull();

		vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
			left: 100,
			top: 200,
			width: 100,
			height: 14,
			right: 200,
			bottom: 214,
			x: 100,
			y: 200,
			toJSON: () => {}
		});

		track.setPointerCapture = vi.fn();
		track.releasePointerCapture = vi.fn();

		track.dispatchEvent(
			new PointerEvent('pointerdown', {
				clientX: 150,
				clientY: 207,
				button: 0,
				pointerId: 1,
				bubbles: true
			})
		);
		expect(track.setPointerCapture).toHaveBeenCalledWith(1);
		expect(player.volume).toBe(0.63);

		track.dispatchEvent(
			new PointerEvent('pointermove', {
				clientX: 180,
				clientY: 207,
				pointerId: 1,
				bubbles: true
			})
		);
		expect(player.volume).toBe(1.0);

		track.dispatchEvent(
			new PointerEvent('pointermove', {
				clientX: 200,
				clientY: 207,
				pointerId: 1,
				bubbles: true
			})
		);
		expect(player.volume).toBe(1.25);

		track.dispatchEvent(
			new PointerEvent('pointerup', {
				clientX: 200,
				clientY: 207,
				pointerId: 1,
				bubbles: true
			})
		);
		expect(track.releasePointerCapture).toHaveBeenCalledWith(1);
	});
});
