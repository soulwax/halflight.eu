import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import TrackTable from './TrackTable.svelte';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const tracks: TrackSummary[] = [
	{ kind: 'track', id: '1', title: 'One', duration: 100, artists: [{ id: 'a', name: 'A' }] },
	{ kind: 'track', id: '2', title: 'Two', duration: 200, artists: [{ id: 'a', name: 'A' }] }
];

describe('TrackTable.svelte', () => {
	it('renders a header row and one row per track', async () => {
		render(TrackTable, { tracks, columns: ['album', 'date', 'duration'] });

		await expect.element(page.getByRole('table')).toBeInTheDocument();
		await expect
			.element(page.getByRole('columnheader', { name: m.track_col_title() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('columnheader', { name: m.track_col_album() }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'One' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Two' })).toBeInTheDocument();
	});

	it('drops the album/date column headers when columns exclude them', async () => {
		render(TrackTable, { tracks, columns: ['duration'] });
		await expect
			.element(page.getByRole('columnheader', { name: m.track_col_album() }))
			.not.toBeInTheDocument();
	});

	it('gives every ordinary track row the shared next, queue, and radio actions', async () => {
		render(TrackTable, { tracks, columns: ['duration'] });

		expect(page.getByRole('button', { name: m.player_play_next() }).all()).toHaveLength(2);
		expect(page.getByRole('button', { name: m.player_add_to_queue() }).all()).toHaveLength(2);
		expect(page.getByRole('button', { name: m.player_start_radio() }).all()).toHaveLength(2);
		expect(page.getByRole('button', { name: m.track_action_menu() }).all()).toHaveLength(2);
	});

	it('passes the row-actions snippet through to every row', async () => {
		render(TrackTable, {
			tracks,
			columns: ['duration'],
			rowActions: createRawSnippet(() => ({
				render: () => '<button type="button">Act</button>'
			}))
		});
		const acts = page.getByRole('button', { name: 'Act' });
		await expect.element(acts.first()).toBeInTheDocument();
		expect(acts.all()).toHaveLength(2);
	});
});
