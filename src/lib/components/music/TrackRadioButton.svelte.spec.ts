import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import { player } from '#lib/player/player.svelte.js';
import type { TrackSummary } from '#lib/tidal/models';
import TrackRadioButton from './TrackRadioButton.svelte';

const seed: TrackSummary = {
	kind: 'track',
	id: 'seed',
	title: 'Seed track',
	artists: [{ id: 'artist-1', name: 'Artist' }]
};

const radioTrack: TrackSummary = {
	kind: 'track',
	id: 'radio-1',
	title: 'Radio track',
	artists: [{ id: 'artist-2', name: 'Radio artist' }]
};

afterEach(() => {
	player.close();
	vi.unstubAllGlobals();
});

describe('TrackRadioButton.svelte', () => {
	it('starts the normalized radio set with an explainable provenance label', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ tracks: [radioTrack] })));
		vi.stubGlobal('fetch', fetchMock);
		render(TrackRadioButton, { track: seed });

		await page.getByRole('button', { name: m.player_start_radio() }).click();

		await expect.poll(() => player.currentTrack?.id).toBe('radio-1');
		expect(fetchMock).toHaveBeenCalledWith('/api/tracks/seed/radio');
		expect(player.currentTrack?.provenance).toBe('Track radio · Seed track');
	});

	it('announces a safe failure when the radio request cannot start', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })));
		render(TrackRadioButton, { track: seed });

		await page.getByRole('button', { name: m.player_start_radio() }).click();

		await expect.element(page.getByText(m.player_radio_unavailable())).toBeInTheDocument();
		expect(player.currentTrack).toBeNull();
	});
});
