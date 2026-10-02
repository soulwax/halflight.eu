import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileLibrary from './MobileLibrary.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { MobileLibraryData } from '#lib/tidal/mobile-library';
import type { TrackSummary } from '#lib/tidal/models';
import { setLocale } from '#lib/paraglide/runtime';
import '../../../routes/layout.css';

const navigation = vi.hoisted(() => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$app/navigation', () => navigation);

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
	navigation.goto.mockReset().mockResolvedValue(undefined);
	navigation.invalidateAll.mockReset().mockResolvedValue(undefined);
	player.queue = [];
	player.currentTrack = null;
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.documentElement.style.fontSize = '';
	await setLocale('en', { reload: false });
	await page.viewport(1280, 900);
});

describe('MobileLibrary.svelte', () => {
	it.each([
		{ width: 320, height: 640, locale: 'en' as const, scale: 1 },
		{ width: 390, height: 844, locale: 'en' as const, scale: 1 },
		{ width: 320, height: 640, locale: 'de-de' as const, scale: 2 },
		{ width: 640, height: 360, locale: 'de-de' as const, scale: 1 }
	])(
		'keeps library actions usable at $width × $height, $locale, text $scale',
		async ({ width, height, locale, scale }) => {
			await page.viewport(width, height);
			await setLocale(locale, { reload: false });
			document.documentElement.style.fontSize = `${16 * scale}px`;
			render(MobileLibrary, { data: savedData });
			const play = page.getByRole('button', {
				name: m.now_library_play({ title: 'After midnight' })
			});
			await expect.element(play).toBeInTheDocument();
			const rect = play.element().getBoundingClientRect();
			expect(rect.width).toBeGreaterThanOrEqual(48);
			expect(rect.height).toBeGreaterThanOrEqual(48);
			expect(rect.right).toBeLessThanOrEqual(width);
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
		}
	);
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
		expect(play).toHaveBeenCalledWith(track, [track], m.now_library_favorites());
	});

	it('shows a retryable state when the collection is unavailable', async () => {
		render(MobileLibrary, { data: { ...savedData, status: 'unavailable', playlists: [] } });

		await expect.element(page.getByRole('alert')).toHaveTextContent(m.now_library_unavailable());
		await expect.element(page.getByRole('button', { name: m.track_retry() })).toBeInTheDocument();
	});
	it('searches through client navigation without replacing the current listening session', async () => {
		player.currentTrack = track;
		render(MobileLibrary, { data: savedData });
		await page.getByRole('searchbox', { name: m.now_library_search_label() }).fill(' Night Drive ');
		await page.getByRole('button', { name: m.search_button(), exact: true }).click();
		expect(navigation.goto).toHaveBeenCalledWith('/library?tab=saved&q=Night+Drive', {
			reset: false
		});
		expect(player.currentTrack).toEqual(track);
	});
	it('refreshes failed data without reloading or changing the queue', async () => {
		player.currentTrack = track;
		player.addToQueue(track);
		const queue = [...player.queue];
		render(MobileLibrary, { data: { ...savedData, status: 'unavailable' } });
		await page.getByRole('button', { name: m.track_retry() }).click();
		expect(navigation.invalidateAll).toHaveBeenCalledOnce();
		expect(player.currentTrack).toEqual(track);
		expect(player.queue).toEqual(queue);
	});
	it('keeps the saved count honest and disables play when every saved track is unavailable', async () => {
		render(MobileLibrary, {
			data: {
				...savedData,
				hiddenTrackCount: 2,
				playlists: [{ id: 'p1', title: 'After midnight', items: [], totalTrackCount: 2 }]
			}
		});
		await expect
			.element(page.getByText(m.now_library_count({ count: 2 }), { exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText(m.now_library_available_count({ count: 0 })))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.now_library_play({ title: 'After midnight' }) }))
			.toBeDisabled();
	});
	it('confirms replacement and starts the selected favorite with its remaining list', async () => {
		player.currentTrack = { ...track, id: 'current', title: 'Already playing' };
		const following = { ...track, id: 't2', title: 'Following track' };
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileLibrary, { data: { ...savedData, tab: 'tracks', tracks: [track, following] } });
		await page.getByRole('button', { name: /Night Drive Loraine James/ }).click();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		expect(play).not.toHaveBeenCalled();
		await page.getByRole('button', { name: m.now_library_confirm() }).click();
		expect(play).toHaveBeenCalledWith(track, [track, following], m.now_library_favorites());
	});
});
