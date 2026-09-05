import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileTrackRow from './MobileTrackRow.svelte';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Bela Lugosi Is Dead',
	artists: [{ id: 'a1', name: 'Bauhaus' }],
	album: { id: 'al1', title: 'Press the Eject' }
};

describe('MobileTrackRow.svelte', () => {
	it('shows the title and artist and activates on tap', async () => {
		const onActivate = vi.fn();
		render(MobileTrackRow, { track, onActivate });

		await expect.element(page.getByText('Bela Lugosi Is Dead')).toBeInTheDocument();
		await expect.element(page.getByText('Bauhaus')).toBeInTheDocument();

		await page.getByRole('button', { name: /Bela Lugosi Is Dead/ }).click();
		expect(onActivate).toHaveBeenCalledOnce();
	});

	it('renders the actions snippet', async () => {
		render(MobileTrackRow, {
			track,
			onActivate: () => {},
			actions: createRawSnippet(() => ({
				render: () => '<button type="button">Remove</button>'
			}))
		});

		await expect.element(page.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
	});
});
