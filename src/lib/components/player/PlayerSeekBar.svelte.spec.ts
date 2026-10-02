import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlayerSeekBar from './PlayerSeekBar.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';

beforeEach(() => {
	player.currentTrack = { kind: 'track', id: 'seek-track', title: 'Track', artists: [] };
	player.playbackMode = 'direct';
	player.isLoading = false;
	player.activeDevice = null;
});
afterEach(() => {
	player.currentTrack = null;
	player.cancelScrub();
});

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

describe('unavailable seeking', () => {
	it('does not invent a timeline for an unknown duration', async () => {
		player.duration = 0;
		await render(PlayerSeekBar);
		const slider = page.getByRole('slider', { name: m.player_seek() });
		await expect.element(slider).toBeDisabled();
		await expect.element(slider).toHaveAttribute('max', '0');
		await expect.element(slider).toHaveAttribute('aria-valuetext', m.player_seek_unavailable());
	});
	it('discards a late seek commit after the selected track changes', async () => {
		player.duration = 200;
		player.currentTime = 12;
		await render(PlayerSeekBar);
		const slider = page.getByRole('slider', { name: m.player_seek() });
		const element = slider.element() as HTMLInputElement;
		element.value = '120';
		element.dispatchEvent(new Event('input', { bubbles: true }));
		player.currentTrack = { kind: 'track', id: 'new-track', title: 'New', artists: [] };
		player.currentTime = 8;
		element.dispatchEvent(new Event('change', { bubbles: true }));
		expect(player.currentTime).toBe(8);
		expect(player.scrubPosition).toBeNull();
	});
});
