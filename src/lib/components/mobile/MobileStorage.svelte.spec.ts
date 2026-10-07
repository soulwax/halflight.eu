import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import type { StorageOverview } from '#lib/storage';
import MobileStorage from './MobileStorage.svelte';

const storage: StorageOverview = {
	privateMusic: {
		status: 'ready',
		data: { fileCount: 1, usedBytes: 1024 ** 2, maxTotalBytes: 512 * 1024 ** 2 }
	},
	privateMusicEnabled: true,
	exportsEnabled: true,
	audioCacheEnabled: false,
	playback: { status: 'ready', data: { queueCount: 3, historyCount: 2, revision: 5 } },
	playlists: { status: 'ready', data: { count: 2 } },
	preferences: { status: 'ready', data: { streamingSaved: true, appearanceSaved: true } }
};

afterEach(() => vi.unstubAllGlobals());

describe('mobile storage controls', () => {
	it('keeps direct downloads available without temporary export storage', async () => {
		render(MobileStorage, { storage: { ...storage, exportsEnabled: false } });
		await expect
			.element(page.getByRole('link', { name: m.storage_export_json() }))
			.toHaveAttribute('href', '/api/private-music/export?format=json');
		await expect
			.element(page.getByRole('button', { name: m.storage_export_create() }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByText(m.storage_session_counts({ queue: 3, history: 2 })))
			.toBeInTheDocument();
	});

	it('creates, downloads and deletes a protected temporary copy', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: 'artifact',
						downloadUrl: '/api/exports/artifact',
						expiresAt: '2030-01-01T12:00:00Z'
					})
				)
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true })));
		vi.stubGlobal('fetch', fetchMock);
		render(MobileStorage, { storage });
		await page.getByRole('button', { name: m.storage_export_create() }).click();
		await expect
			.element(page.getByRole('link', { name: m.storage_export_download() }))
			.toHaveAttribute('href', '/api/exports/artifact');
		await page.getByRole('button', { name: m.storage_export_delete() }).click();
		await expect.element(page.getByText(m.storage_export_deleted())).toBeInTheDocument();
		expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/private-music/export?format=json', {
			method: 'POST'
		});
		expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/exports/artifact', { method: 'DELETE' });
		await expect
			.element(page.getByRole('link', { name: m.storage_export_download() }))
			.not.toBeInTheDocument();
	});

	it('keeps a copy available when deletion fails and allows retry', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify({
							id: 'artifact',
							downloadUrl: '/api/exports/artifact',
							expiresAt: '2030-01-01T12:00:00Z'
						})
					)
				)
				.mockResolvedValueOnce(new Response('', { status: 503 }))
		);
		render(MobileStorage, { storage });
		await page.getByRole('button', { name: m.storage_export_create() }).click();
		await page.getByRole('button', { name: m.storage_export_delete() }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.storage_export_error());
		await expect
			.element(page.getByRole('button', { name: m.storage_export_delete() }))
			.toBeEnabled();
		await expect
			.element(page.getByRole('link', { name: m.storage_export_download() }))
			.toBeInTheDocument();
	});
});
