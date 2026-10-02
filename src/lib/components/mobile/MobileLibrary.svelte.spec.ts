import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	privateMusic: {
		enabled: true,
		formats: [{ label: 'MP3', contentType: 'audio/mpeg', extensions: ['mp3'] }],
		storage: {
			fileCount: 0,
			usedBytes: 0,
			availableBytes: 512 * 1024 * 1024,
			maxTotalBytes: 512 * 1024 * 1024,
			maxFileBytes: 128 * 1024 * 1024
		},
		files: []
	},
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

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('MobileLibrary.svelte', () => {
	it('shows the three library views and saved-playlist actions', async () => {
		render(MobileLibrary, { data: savedData });

		await expect
			.element(page.getByRole('heading', { name: m.now_tab_library() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_library_saved() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_library_private_music() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_library_favorites() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: /After midnight/ }))
			.toHaveAttribute('href', '/playlists/p1');
		await page.getByRole('button', { name: m.player_add_to_queue() }).click();
		expect(player.queue).toEqual([
			expect.objectContaining({ id: track.id, provenance: 'After midnight' })
		]);
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent(m.now_library_added({ title: 'After midnight' }));
	});

	it('keeps private music available without a TIDAL connection', async () => {
		render(MobileLibrary, {
			data: { ...savedData, tab: 'private', status: 'disconnected' }
		});

		await expect
			.element(page.getByRole('heading', { name: m.private_music_title() }))
			.toBeInTheDocument();
		await expect.element(page.getByText(m.private_music_empty())).toBeInTheDocument();
	});

	it('confirms and removes a private file without involving the TIDAL player', async () => {
		const remove = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', remove);
		render(MobileLibrary, {
			data: {
				...savedData,
				tab: 'private',
				privateMusic: {
					...savedData.privateMusic,
					storage: { ...savedData.privateMusic.storage, fileCount: 1, usedBytes: 42 },
					files: [
						{
							id: 'private-1',
							fileName: 'night-drive.mp3',
							contentType: 'audio/mpeg',
							sizeBytes: 42,
							createdAt: '2026-09-15T00:00:00.000Z',
							downloadUrl: '/api/private-music/private-1'
						}
					]
				}
			}
		});

		await page
			.getByRole('button', { name: m.private_music_delete({ file: 'night-drive.mp3' }) })
			.click();
		await page.getByRole('button', { name: m.private_music_delete_action() }).click();

		expect(remove).toHaveBeenCalledWith('/api/private-music/private-1', { method: 'DELETE' });
		await expect.element(page.getByText(m.private_music_empty())).toBeInTheDocument();
		expect(player.currentTrack).toBeNull();
	});

	it('puts a favorite on deck and reports it', async () => {
		render(MobileLibrary, {
			data: { ...savedData, tab: 'tracks', playlists: [], tracks: [track] }
		});

		await page.getByRole('button', { name: m.track_action_menu() }).click();
		await page.getByRole('button', { name: m.track_action_play_next() }).click();
		expect(player.queue).toEqual([
			expect.objectContaining({ id: track.id, provenance: m.now_library_favorites() })
		]);
		expect(player.currentTrack).toBeNull();
	});

	it('plays a favorite when its art-led row is tapped', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileLibrary, {
			data: { ...savedData, tab: 'tracks', playlists: [], tracks: [track] }
		});

		await page.getByRole('button', { name: /Night Drive Loraine James/ }).click();
		expect(play).toHaveBeenCalledWith(track, [track], track.title);
	});

	it('shows a retryable state when the collection is unavailable', async () => {
		render(MobileLibrary, { data: { ...savedData, status: 'unavailable', playlists: [] } });

		await expect.element(page.getByRole('alert')).toHaveTextContent(m.now_library_unavailable());
		await expect.element(page.getByRole('button', { name: m.track_retry() })).toBeInTheDocument();
	});
});
