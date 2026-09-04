import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import TrackTableRow from './TrackTableRow.svelte';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '55',
	title: 'Get Lucky',
	duration: 248,
	artists: [{ id: 'a1', name: 'Daft Punk' }],
	album: { id: 'al1', title: 'Random Access Memories', releaseDate: '2013-05-17' }
};

describe('TrackTableRow.svelte', () => {
	it('shows the title, artist, album, release year and duration', () => {
		render(TrackTableRow, { track, columns: ['album', 'date', 'duration'], onActivate: () => {} });

		const text = document.body.textContent ?? '';
		expect(text).toContain('Get Lucky');
		expect(text).toContain('Daft Punk');
		expect(text).toContain('Random Access Memories');
		expect(text).toContain('2013');
		expect(text).toContain('4:08');
	});

	it('points the title, artist and album at their pages', async () => {
		render(TrackTableRow, { track, columns: ['album'], onActivate: () => {} });
		const links = page.getByRole('link').all();
		const hrefs = links.map((l) => l.element().getAttribute('href'));
		expect(hrefs).toContain('/app/tracks/55');
		expect(hrefs).toContain('/app/artists/a1');
		expect(hrefs).toContain('/app/albums/al1');
	});

	it('calls onActivate from the cover play button', async () => {
		const onActivate = vi.fn();
		render(TrackTableRow, { track, columns: ['duration'], onActivate });
		await page.getByRole('button', { name: m.player_play_track() }).click();
		expect(onActivate).toHaveBeenCalledOnce();
	});

	it('renders the row actions snippet', async () => {
		render(TrackTableRow, {
			track,
			columns: ['duration'],
			onActivate: () => {},
			actions: createRawSnippet(() => ({
				render: () => '<button type="button">Remove</button>'
			}))
		});
		await expect.element(page.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
	});

	it('falls back to a dash when the album / date columns have no data', async () => {
		render(TrackTableRow, {
			track: { ...track, album: undefined, duration: undefined },
			columns: ['album', 'date', 'duration'],
			onActivate: () => {}
		});
		await expect.element(page.getByText('—').first()).toBeInTheDocument();
	});
});
