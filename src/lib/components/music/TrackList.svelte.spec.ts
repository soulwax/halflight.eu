import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TrackList from './TrackList.svelte';
import type { TrackSummary } from '#lib/tidal/models';

const tracks: TrackSummary[] = [
	{ kind: 'track', id: '1', title: 'One', duration: 100, artists: [{ id: 'a', name: 'A' }] },
	{ kind: 'track', id: '2', title: 'Two', duration: 200, artists: [{ id: 'a', name: 'A' }] }
];

describe('TrackList.svelte', () => {
	it('renders one row per track inside an ordered list', async () => {
		render(TrackList, { tracks });
		await expect.element(page.getByRole('list')).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'One' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Two' })).toBeInTheDocument();
	});
});
