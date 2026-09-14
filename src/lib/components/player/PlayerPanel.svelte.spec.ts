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
