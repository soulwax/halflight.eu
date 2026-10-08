import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import { player } from '#lib/player/player.svelte.js';
import type { TrackSummary } from '#lib/tidal/models';
import PlayerPanel from './PlayerPanel.svelte';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Bela Lugosi Is Dead',
	artists: [{ id: 'a1', name: 'Bauhaus' }]
};

afterEach(() => {
	player.currentTrack = null;
	player.isExpanded = false;
	player.panel = 'queue';
});

describe('PlayerPanel.svelte', () => {
	it('keeps details open when the active tab is selected again', async () => {
		player.isExpanded = true;
		player.panel = 'source';
		render(PlayerPanel, { track, floating: false, onDragStart: () => {} });

		const sourceTab = page.getByRole('tab', { name: m.player_source() });
		await sourceTab.click();
		expect(player.isExpanded).toBe(true);
		await expect.element(sourceTab).toHaveAttribute('aria-selected', 'true');
	});
});
it('minimises without stopping playback or discarding the selected panel', async () => {
	player.currentTrack = track;
	player.isExpanded = true;
	player.panel = 'lyrics';
	player.isPlaying = true;
	render(PlayerPanel, { track, floating: false, onDragStart: () => {} });
	await page.getByRole('button', { name: m.player_collapse() }).click();
	expect(player.isExpanded).toBe(false);
	expect(player.panel).toBe('lyrics');
	expect(player.isPlaying).toBe(true);
	expect(player.currentTrack?.id).toBe(track.id);
	player.isPlaying = false;
});
