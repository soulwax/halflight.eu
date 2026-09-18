import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QueuePanel from './QueuePanel.svelte';
import { player } from '#lib/player/player.svelte.js';
import { createQueueEntry } from '#lib/player/queue-entry.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

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
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('QueuePanel.svelte', () => {
	it('gives a stalled "Track details are unavailable" entry another chance on open', async () => {
		// A track that failed its one automatic hydration attempt during a
		// connection blip stays a stub until something asks again; opening the
		// queue is the moment that stub is actually seen, so it must ask again.
		const retry = vi.spyOn(player, 'retryUnresolvedMetadata').mockImplementation(() => {});
		render(QueuePanel);
		expect(retry).toHaveBeenCalledOnce();
	});

	it('shows the empty-queue message when nothing is queued', async () => {
		render(QueuePanel);
		await expect.element(page.getByText(m.player_queue_empty())).toBeInTheDocument();
	});

	it('lists the queued tracks as a table with remove controls', async () => {
		player.queue = [entry('1', 'One'), entry('2', 'Two')];
		render(QueuePanel);

		await expect.element(page.getByRole('link', { name: 'One' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Two' })).toBeInTheDocument();

		const removes = page.getByRole('button', { name: m.player_remove_from_queue() });
		(removes.first().element() as HTMLButtonElement).click();
		expect(player.queue.map((t) => t.id)).toEqual(['2']);
	});

	it('removes only the selected occurrence when a track is queued twice', async () => {
		player.queue = [entry('1', 'One'), entry('1', 'One')];
		render(QueuePanel);

		(
			page
				.getByRole('button', { name: m.player_remove_from_queue() })
				.nth(1)
				.element() as HTMLButtonElement
		).click();

		expect(player.queue).toHaveLength(1);
		expect(player.queue[0]?.id).toBe('1');
	});

	it('starts the selected queued track and leaves later entries upcoming', async () => {
		player.currentTrack = mk('current', 'Current');
		player.queue = [entry('1', 'One'), entry('2', 'Two')];
		render(QueuePanel);

		const title = page.getByRole('link', { name: 'Two' }).element();
		const row = title.closest('.tt-row');
		expect(row).not.toBeNull();
		(row?.querySelector('.tt-play') as HTMLButtonElement | null)?.click();

		expect(player.currentTrack?.id).toBe('2');
		expect(player.history.map((track) => track.id)).toContain('current');
		expect(player.queue.map((track) => track.id)).toEqual(['1']);
	});

	it('offers save + clear when there is a queue', async () => {
		player.queue = [entry('1', 'One')];
		render(QueuePanel);
		await expect
			.element(page.getByRole('button', { name: m.player_clear_queue() }))
			.toBeInTheDocument();
		(
			page.getByRole('button', { name: m.player_clear_queue() }).element() as HTMLButtonElement
		).click();
		expect(player.queue).toEqual([]);
	});

	it('reorders queued tracks on move up/down', async () => {
		player.queue = [entry('1', 'One'), entry('2', 'Two')];
		render(QueuePanel);

		const moveDown = page.getByRole('button', { name: m.player_move_down() });
		(moveDown.first().element() as HTMLButtonElement).click();
		expect(player.queue.map((t) => t.id)).toEqual(['2', '1']);
	});
});
