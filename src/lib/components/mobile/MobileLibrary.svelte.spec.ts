import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileLibrary from './MobileLibrary.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { MobileLibraryData } from '#lib/tidal/mobile-library';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: 't1',
	title: 'Night Drive',
	duration: 240,
	artists: [{ id: 'a1', name: 'Loraine James' }]
};

const savedData: MobileLibraryData = {
	tab: 'saved',
	status: 'ready',
	tracks: [],
	previousQuery: null,
	nextQuery: null,
	hasMore: false,
	playlists: [{ id: 'p1', title: 'After midnight', items: [track] }]
};

beforeEach(() => {
	player.queue = [];
	player.currentTrack = null;
});

describe('MobileLibrary.svelte', () => {
	it('shows the two library views and saved-playlist actions', async () => {
		render(MobileLibrary, { data: savedData });

		await expect
			.element(page.getByRole('heading', { name: m.now_tab_library() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_library_saved() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_library_favorites() }))
			.toBeInTheDocument();
		await expect.element(page.getByText('After midnight')).toBeInTheDocument();
		await page.getByRole('button', { name: m.player_add_to_queue() }).click();
		expect(player.queue).toEqual([
			expect.objectContaining({ id: track.id, provenance: 'After midnight' })
		]);
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent(m.now_library_added({ title: 'After midnight' }));
	});

	it('puts a favorite on deck and reports it', async () => {
		render(MobileLibrary, {
			data: { ...savedData, tab: 'tracks', playlists: [], tracks: [track] }
		});

		await page.getByRole('button', { name: m.player_play_next() }).click();
		expect(player.queue).toEqual([
			expect.objectContaining({ id: track.id, provenance: m.now_library_favorites() })
		]);
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent(m.now_library_next_added({ title: track.title }));
	});

	it('shows a retryable state when the collection is unavailable', async () => {
		render(MobileLibrary, { data: { ...savedData, status: 'unavailable', playlists: [] } });

		await expect.element(page.getByRole('alert')).toHaveTextContent(m.now_library_unavailable());
		await expect.element(page.getByRole('button', { name: m.track_retry() })).toBeInTheDocument();
	});
});
