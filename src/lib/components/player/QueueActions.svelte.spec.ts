import { page } from 'vitest/browser';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QueueActions from './QueueActions.svelte';
import { player } from '#lib/player/player.svelte';
import { customPlaylists } from '#lib/player/customPlaylists.svelte';
import { createQueueEntry } from '#lib/player/queue-entry';
import { m } from '#lib/paraglide/messages';
const track = { kind: 'track' as const, id: 'same', title: 'Track', artists: [] };
afterEach(() => {
	player.currentTrack = null;
	player.queue = [];
	customPlaylists.playlists = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(() => Promise.reject(new Error('fetch disabled in component tests')))
	);
});
it('keeps the queue and name after a failed save, then retries the same request identity', async () => {
	player.currentTrack = track;
	player.queue = [createQueueEntry(track), createQueueEntry(track)];
	customPlaylists.playlists = [];
	const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body)) as {
			id: string;
			title: string;
			items: (typeof track)[];
		};
		if (fetch.mock.calls.length === 1) return new Response(null, { status: 503 });
		return Response.json({
			playlist: { ...body, createdAt: '2026-10-02', updatedAt: '2026-10-02' }
		});
	});
	vi.stubGlobal('fetch', fetch);
	await render(QueueActions);
	await page.getByRole('button', { name: m.player_save_queue() }).click();
	await page.getByRole('textbox', { name: m.player_queue_save_name() }).fill('Night drive');
	await page.getByRole('button', { name: m.player_queue_save_action() }).click();
	await expect.element(page.getByRole('alert')).toHaveTextContent(m.player_queue_save_error());
	expect(player.queue).toHaveLength(2);
	expect(customPlaylists.playlists).toEqual([]);
	await expect.element(page.getByRole('textbox')).toHaveValue('Night drive');
	await page.getByRole('button', { name: m.player_queue_save_action() }).click();
	await expect
		.element(page.getByText(m.player_queue_save_success({ title: 'Night drive' })))
		.toBeInTheDocument();
	const first = JSON.parse(String(fetch.mock.calls[0][1]?.body));
	const second = JSON.parse(String(fetch.mock.calls[1][1]?.body));
	expect(second.id).toBe(first.id);
	expect(second.syncTidal).toBe(false);
	expect(second.items).toHaveLength(3);
	expect(customPlaylists.playlists).toHaveLength(1);
	expect(player.currentTrack?.id).toBe(track.id);
});
