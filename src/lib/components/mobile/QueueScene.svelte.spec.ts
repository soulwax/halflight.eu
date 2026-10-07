import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QueueScene from './QueueScene.svelte';
import { player } from '#lib/player/player.svelte.js';
import { createQueueEntry } from '#lib/player/queue-entry.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';
import '../../../routes/layout.css';

const mk = (id: string, title: string): TrackSummary => ({
	kind: 'track',
	id,
	title,
	duration: 180,
	artists: [{ id: 'a', name: 'A' }]
});

const entry = (id: string, title: string) => createQueueEntry(mk(id, title));

beforeEach(() => {
	player.queue = [];
	player.currentTrack = null;
	player.history = [];
	player.persistenceStatus = 'saved';
});

afterEach(() => vi.restoreAllMocks());

describe('QueueScene.svelte', () => {
	it('shows the empty-queue message and a way back to Now Playing', async () => {
		await render(QueueScene);

		await expect.element(page.getByText(m.player_queue_empty())).toBeInTheDocument();
		const back = page.getByRole('link', { name: m.now_queue_back() });
		await expect.element(back).toBeInTheDocument();
		expect(back.element().getAttribute('href')).toBe('/now');
	});

	it('lists queued tracks and plays one from the queue on tap', async () => {
		player.queue = [
			createQueueEntry({
				...mk('1', 'One'),
				album: { id: 'album-1', title: 'An entire album name' }
			}),
			entry('2', 'Two')
		];
		await render(QueueScene);

		await expect.element(page.getByText('One', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Two', { exact: true })).toBeInTheDocument();
		await expect
			.element(page.getByText('An entire album name', { exact: true }))
			.toBeInTheDocument();

		await page.getByRole('button', { name: /^Two/ }).click();
		expect(player.currentTrack?.id).toBe('2');
	});

	it("keeps dense two-line rows at phone width with names in each row's accessible name", async () => {
		const title = 'A long recording title that needs more than one line';
		const artist = 'An artist with a complete and very long name';
		const album = 'An album title that must remain readable in the queue';
		player.queue = [
			createQueueEntry({
				...mk('1', title),
				artists: [{ id: 'artist-1', name: artist }],
				album: { id: 'album-1', title: album }
			}),
			entry('2', 'Two')
		];
		const { container } = await render(QueueScene);
		container.style.width = '320px';
		const play = page.getByRole('button', { name: new RegExp(`^${title}`) });
		await expect.element(play).toBeInTheDocument();
		// Truncated visually, complete for assistive technology.
		expect(play.element().textContent).toContain(artist);
		expect(play.element().textContent).toContain(album);
		const row = container.querySelector('.mobile-track-row')!;
		expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(60);
		expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
		for (const name of [m.player_move_up(), m.player_move_down(), m.player_remove_from_queue()]) {
			const rect = page.getByRole('button', { name }).first().element().getBoundingClientRect();
			expect(rect.width).toBeGreaterThanOrEqual(24);
			expect(rect.height).toBeGreaterThanOrEqual(24);
		}
	});

	it('shows the current track separately from the upcoming queue', async () => {
		player.currentTrack = mk('current', 'Current song');
		player.queue = [entry('next', 'Queued song')];
		await render(QueueScene);

		await expect.element(page.getByText('Current song', { exact: true })).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: m.player_now_playing() }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Queued song', { exact: true })).toBeInTheDocument();
		expect(player.currentTrack?.id).toBe('current');
	});

	it('reorders and removes queued tracks', async () => {
		player.currentTrack = mk('current', 'Now playing');
		player.queue = [entry('1', 'One'), entry('2', 'Two')];
		await render(QueueScene);

		await page.getByRole('button', { name: m.player_move_down() }).first().click();
		expect(player.queue.map((t) => t.id)).toEqual(['2', '1']);

		await page.getByRole('button', { name: m.player_remove_from_queue() }).first().click();
		expect(player.queue.map((t) => t.id)).toEqual(['1']);
		expect(player.currentTrack?.id).toBe('current');
	});

	it('removes one duplicate by queue-entry identity without changing the current track', async () => {
		player.currentTrack = mk('current', 'Now playing');
		player.queue = [entry('same', 'Duplicate'), entry('same', 'Duplicate')];
		const secondEntryId = player.queue[1].entryId;
		await render(QueueScene);

		await page.getByRole('button', { name: m.player_remove_from_queue() }).first().click();
		expect(player.queue).toHaveLength(1);
		expect(player.queue[0].entryId).toBe(secondEntryId);
		expect(player.currentTrack?.id).toBe('current');
	});

	it('keeps pending queue saves quiet', async () => {
		player.persistenceStatus = 'saving';
		await render(QueueScene);

		await expect
			.element(page.getByRole('status', { name: m.player_sync_saving() }))
			.not.toBeInTheDocument();
	});

	it('offers conflict refresh while keeping the current track playing', async () => {
		player.currentTrack = mk('current', 'Now playing');
		player.persistenceStatus = 'conflict';
		const refresh = vi.spyOn(player, 'refreshQueueFromServer').mockResolvedValue();
		await render(QueueScene);

		await page.getByRole('button', { name: m.player_sync_conflict() }).click();
		await page.getByRole('button', { name: m.player_sync_refresh() }).click();
		expect(refresh).toHaveBeenCalledOnce();
		expect(player.currentTrack?.id).toBe('current');
	});

	it('offers retry after a save error without changing the current track', async () => {
		player.currentTrack = mk('current', 'Now playing');
		player.persistenceStatus = 'server_error';
		const retry = vi.spyOn(player, 'retryPersistence').mockImplementation(() => {});
		await render(QueueScene);

		await page.getByRole('button', { name: m.player_sync_local() }).click();
		await page.getByRole('button', { name: m.player_sync_retry() }).click();
		expect(retry).toHaveBeenCalledOnce();
		expect(player.currentTrack?.id).toBe('current');
	});

	it('offers clear queue only when there is one', async () => {
		await render(QueueScene);
		await expect
			.element(page.getByRole('button', { name: m.player_clear_queue() }))
			.not.toBeInTheDocument();

		player.queue = [entry('1', 'One')];
		await page.getByRole('button', { name: m.player_clear_queue() }).click();
		expect(player.queue).toHaveLength(1);
		await page.getByRole('dialog').getByRole('button', { name: m.player_clear_queue() }).click();
		expect(player.queue).toEqual([]);
	});

	it('announces where a moved entry landed and keeps focus on its controls', async () => {
		player.queue = [entry('1', 'One'), entry('2', 'Two'), entry('3', 'Three')];
		await render(QueueScene);

		const down = page.getByRole('button', { name: m.player_move_down() }).first();
		await down.click();
		expect(player.queue.map((t) => t.id)).toEqual(['2', '1', '3']);

		await expect
			.element(page.getByText(m.player_queue_moved({ title: 'One', position: 2, total: 3 })))
			.toBeInTheDocument();
		expect(document.activeElement?.getAttribute('aria-label')).toBe(m.player_move_down());
	});

	it('hands focus to the opposite control when an entry reaches an end', async () => {
		player.queue = [entry('1', 'One'), entry('2', 'Two')];
		await render(QueueScene);

		// Move "Two" up to the top; its own Move up button becomes disabled there.
		await page.getByRole('button', { name: m.player_move_up() }).nth(1).click();
		expect(player.queue.map((t) => t.id)).toEqual(['2', '1']);

		expect(document.activeElement?.getAttribute('aria-label')).toBe(m.player_move_down());
		expect((document.activeElement as HTMLButtonElement | null)?.disabled).toBe(false);
	});
});
