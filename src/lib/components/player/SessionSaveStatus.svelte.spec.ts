import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import SessionSaveStatus from './SessionSaveStatus.svelte';

afterEach(() => {
	player.persistenceStatus = 'saved';
	player.localQueueSaved = true;
	vi.restoreAllMocks();
});

describe('SessionSaveStatus', () => {
	it.each([false, true])(
		'renders no indicator for routine saving or saved states (mobile: %s)',
		async (mobile) => {
			player.persistenceStatus = 'saving';
			const { container } = render(SessionSaveStatus, { mobile, compactText: mobile });
			await expect
				.element(page.getByRole('status', { name: m.player_sync_saving() }))
				.not.toBeInTheDocument();
			expect(container.querySelector('.session-save-status')).toBeNull();
			player.persistenceStatus = 'saved';
			await expect
				.element(page.getByRole('status', { name: m.player_sync_saved() }))
				.not.toBeInTheDocument();
			expect(container.querySelector('.session-save-status')).toBeNull();
		}
	);
	it('reveals local backup details and retry only when the icon is opened', async () => {
		player.persistenceStatus = 'offline';
		const retry = vi.spyOn(player, 'retryPersistence').mockImplementation(() => {});
		render(SessionSaveStatus);
		await expect.element(page.getByText(m.player_sync_local())).not.toBeInTheDocument();
		await page.getByRole('button', { name: m.player_sync_local() }).click();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await page.getByRole('button', { name: m.player_sync_retry() }).click();
		expect(retry).toHaveBeenCalledOnce();
		player.persistenceStatus = 'saved';
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});
	it('does not claim a browser backup when browser storage failed', async () => {
		player.persistenceStatus = 'server_error';
		player.localQueueSaved = false;
		render(SessionSaveStatus);
		await expect
			.element(page.getByRole('button', { name: m.player_sync_delayed() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_sync_local() }))
			.not.toBeInTheDocument();
	});
	it('distinguishes a Redis backup from a confirmed database save', async () => {
		player.persistenceStatus = 'buffered';
		render(SessionSaveStatus);
		await expect
			.element(page.getByRole('button', { name: m.player_sync_buffered() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('status', { name: m.player_sync_saved() }))
			.not.toBeInTheDocument();
	});
});
