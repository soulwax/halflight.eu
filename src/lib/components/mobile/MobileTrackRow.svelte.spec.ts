import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileTrackRow from './MobileTrackRow.svelte';
import { m } from '#lib/paraglide/messages.js';
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

	it('hides unresolved provider identifiers until live metadata arrives', async () => {
		render(MobileTrackRow, {
			track: {
				kind: 'track',
				id: '9',
				title: '9',
				artists: [{ id: 'a1', name: 'a1' }]
			},
			onActivate: () => {}
		});

		await expect.element(page.getByText(m.track_unavailable_title())).toBeInTheDocument();
		expect(document.body.textContent).not.toContain('a1');
	});
});
