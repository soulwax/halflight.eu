import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
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
});

describe('QueuePanel.svelte', () => {
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
		await removes.first().click();
		expect(player.queue.map((t) => t.id)).toEqual(['2']);
	});

	it('offers save + clear when there is a queue', async () => {
		player.queue = [entry('1', 'One')];
		render(QueuePanel);
		await expect
			.element(page.getByRole('button', { name: m.player_clear_queue() }))
			.toBeInTheDocument();
		await page.getByRole('button', { name: m.player_clear_queue() }).click();
		expect(player.queue).toEqual([]);
	});

	it('reorders queued tracks on move up/down', async () => {
		player.queue = [entry('1', 'One'), entry('2', 'Two')];
		render(QueuePanel);

		const moveDown = page.getByRole('button', { name: m.player_move_down() });
		await moveDown.first().click();
		expect(player.queue.map((t) => t.id)).toEqual(['2', '1']);
	});
});
