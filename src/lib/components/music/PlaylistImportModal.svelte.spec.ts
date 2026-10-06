import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlaylistImportModal from './PlaylistImportModal.svelte';
import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
import { m } from '#lib/paraglide/messages.js';

const playlists = [
	{
		id: 'remote-1',
		title: 'Night Drive',
		numberOfItems: 12,
		isImported: false
	},
	{
		id: 'remote-2',
		title: 'Already Here',
		numberOfItems: 4,
		isImported: true
	},
	{
		id: 'remote-3',
		title: 'Sunday Morning',
		numberOfItems: 8,
		isImported: false
	}
];

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

beforeEach(() => {
	customPlaylists.isImportOpen = true;
	customPlaylists.playlists = [];
});

afterEach(() => {
	customPlaylists.isImportOpen = false;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('PlaylistImportModal.svelte', () => {
	it('loads remote playlists and disables already imported entries', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ playlists }));
		vi.stubGlobal('fetch', fetchMock);

		render(PlaylistImportModal);

		await expect.element(page.getByText('Night Drive')).toBeInTheDocument();
		await expect.element(page.getByText('Already Here')).toBeInTheDocument();
		await expect.element(page.getByText(m.playlist_synced())).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: `${m.playlist_import()} (0)` }))
			.toBeDisabled();

		const checkboxes = page.getByRole('checkbox');
		expect(checkboxes).toHaveLength(3);
		expect((checkboxes.nth(1).element() as HTMLInputElement).disabled).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith('/api/playlists/import');
	});

	it('selects only unimported playlists and posts their IDs, then refreshes the store', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ playlists }))
			.mockResolvedValueOnce(
				jsonResponse({
					totalImported: 2,
					totalErrors: 0,
					totalTracksSkipped: 0,
					totalTracksReplaced: 0,
					streamValidation: 'deferred'
				})
			)
			.mockResolvedValueOnce(jsonResponse({ playlists }));
		vi.stubGlobal('fetch', fetchMock);
		const syncWithServer = vi.spyOn(customPlaylists, 'syncWithServer').mockResolvedValue(undefined);

		render(PlaylistImportModal);
		await expect.element(page.getByText('Night Drive')).toBeInTheDocument();

		const checkboxes = page.getByRole('checkbox');
		(checkboxes.nth(0).element() as HTMLInputElement).click();
		(checkboxes.nth(2).element() as HTMLInputElement).click();
		const importButton = page.getByRole('button', { name: `${m.playlist_import()} (2)` });
		await expect.element(importButton).toBeEnabled();
		(importButton.element() as HTMLButtonElement).click();

		await expect
			.element(page.getByText(m.playlist_import_done(), { exact: false }))
			.toBeInTheDocument();
		expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/playlists/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tidalPlaylistIds: ['remote-1', 'remote-3'] })
		});
		expect(syncWithServer).toHaveBeenCalledOnce();
	});

	it('select all targets unimported playlists and can be cleared again', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ playlists })));
		render(PlaylistImportModal);
		await expect.element(page.getByText('Night Drive')).toBeInTheDocument();

		const selectAll = page.getByRole('button', { name: 'Select all unimported' });
		(selectAll.element() as HTMLButtonElement).click();
		await expect
			.element(page.getByRole('button', { name: `${m.playlist_import()} (2)` }))
			.toBeEnabled();
		await expect.element(page.getByRole('button', { name: 'Deselect all' })).toBeInTheDocument();

		(page.getByRole('button', { name: 'Deselect all' }).element() as HTMLButtonElement).click();
		await expect
			.element(page.getByRole('button', { name: `${m.playlist_import()} (0)` }))
			.toBeDisabled();
	});

	it('does not surface API sync failures in the interface', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ playlists }))
			.mockResolvedValueOnce(
				jsonResponse({
					totalImported: 0,
					totalErrors: 1,
					totalTracksSkipped: 0,
					totalTracksReplaced: 0,
					streamValidation: 'deferred',
					imported: [{ tidalPlaylistId: 'remote-1', status: 'error' }]
				})
			)
			.mockResolvedValueOnce(jsonResponse({ playlists }));
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(customPlaylists, 'syncWithServer').mockResolvedValue(undefined);

		render(PlaylistImportModal);
		await expect.element(page.getByText('Night Drive')).toBeInTheDocument();
		(page.getByRole('checkbox').nth(0).element() as HTMLInputElement).click();
		const importButton = page.getByRole('button', { name: `${m.playlist_import()} (1)` });
		await expect.element(importButton).toBeEnabled();
		(importButton.element() as HTMLButtonElement).click();

		await expect.element(page.getByText('Night Drive')).toBeInTheDocument();
		expect(page.getByRole('alert').length).toBe(0);
	});

	it('keeps the chooser quiet when loading playlists fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream failure')));
		render(PlaylistImportModal);
		await expect.element(page.getByText(m.playlist_no_playlists())).toBeInTheDocument();
		expect(page.getByRole('alert').length).toBe(0);
	});
});
