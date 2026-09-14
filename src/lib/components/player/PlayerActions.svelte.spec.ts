import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import { player } from '#lib/player/player.svelte.js';
import type { TrackSummary } from '#lib/tidal/models';
import PlayerActions from './PlayerActions.svelte';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Bela Lugosi Is Dead',
	artists: [{ id: 'a1', name: 'Bauhaus' }]
};

afterEach(() => {
	player.isExpanded = false;
	player.panel = 'queue';
});

describe('PlayerActions.svelte', () => {
	it('keeps contextual panels direct and names playback details explicitly in More actions', async () => {
		render(PlayerActions, {
			track,
			floating: false,
			isNarrow: false,
			tidalUrl: 'https://tidal.com/browse/track/9'
		});

		await expect.element(page.getByRole('button', { name: m.player_queue() })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: m.player_lyrics() })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_expand() }))
			.not.toBeInTheDocument();

		await page.getByRole('button', { name: m.track_action_menu() }).click();
		const details = page.getByRole('menuitem', { name: m.player_source() });
		await expect.element(details).toBeInTheDocument();
		await details.click();
		expect(player.isExpanded).toBe(true);
		expect(player.panel).toBe('source');
	});
});
