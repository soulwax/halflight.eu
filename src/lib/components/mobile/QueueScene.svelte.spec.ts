import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QueueScene from './QueueScene.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const mk = (id: string, title: string): TrackSummary => ({
	kind: 'track',
	id,
	title,
	duration: 180,
	artists: [{ id: 'a', name: 'A' }]
});

beforeEach(() => {
	player.queue = [];
	player.currentTrack = null;
});

describe('QueueScene.svelte', () => {
	it('shows the empty-queue message and a way back to Now Playing', async () => {
		await render(QueueScene);

		await expect.element(page.getByText(m.player_queue_empty())).toBeInTheDocument();
		const back = page.getByRole('link', { name: m.now_queue_back() });
		await expect.element(back).toBeInTheDocument();
		expect(back.element().getAttribute('href')).toBe('/now');
	});

	it('lists queued tracks and plays one from the queue on tap', async () => {
		player.queue = [mk('1', 'One'), mk('2', 'Two')];
		await render(QueueScene);

		await expect.element(page.getByText('One')).toBeInTheDocument();
		await expect.element(page.getByText('Two')).toBeInTheDocument();

		await page.getByRole('button', { name: /^Two/ }).click();
		expect(player.currentTrack?.id).toBe('2');
	});

	it('reorders and removes queued tracks', async () => {
		player.queue = [mk('1', 'One'), mk('2', 'Two')];
		await render(QueueScene);

		await page.getByRole('button', { name: m.player_move_down() }).first().click();
		expect(player.queue.map((t) => t.id)).toEqual(['2', '1']);

		await page.getByRole('button', { name: m.player_remove_from_queue() }).first().click();
		expect(player.queue.map((t) => t.id)).toEqual(['1']);
	});

	it('offers clear queue only when there is one', async () => {
		await render(QueueScene);
		await expect
			.element(page.getByRole('button', { name: m.player_clear_queue() }))
			.not.toBeInTheDocument();

		player.queue = [mk('1', 'One')];
		await page.getByRole('button', { name: m.player_clear_queue() }).click();
		expect(player.queue).toEqual([]);
	});
});
