import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileMixRail from './MobileMixRail.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const tracks: TrackSummary[] = [
	{
		kind: 'track',
		id: '1',
		title: 'Bela Lugosi Is Dead',
		artists: [{ id: 'a1', name: 'Bauhaus' }],
		album: { id: 'al1', title: 'Press the Eject' }
	},
	{
		kind: 'track',
		id: '2',
		title: 'Dark Entries',
		artists: [{ id: 'a1', name: 'Bauhaus' }]
	}
];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('MobileMixRail.svelte', () => {
	it('renders nothing without tracks', () => {
		const { container } = render(MobileMixRail, { tracks: [] });
		expect(container.querySelector('.mix-rail')).toBeNull();
	});

	it('lists the mix under its heading', async () => {
		render(MobileMixRail, { tracks });

		await expect.element(page.getByText(m.now_home_mix_heading())).toBeInTheDocument();
		await expect.element(page.getByText('Bela Lugosi Is Dead')).toBeInTheDocument();
		await expect.element(page.getByText('Dark Entries')).toBeInTheDocument();
	});

	it('plays a tapped track in the context of the whole mix', async () => {
		const playSpy = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileMixRail, { tracks });

		await page.getByRole('button', { name: /Bela Lugosi Is Dead/ }).click();

		expect(playSpy).toHaveBeenCalledWith(tracks[0], tracks);
	});
});
