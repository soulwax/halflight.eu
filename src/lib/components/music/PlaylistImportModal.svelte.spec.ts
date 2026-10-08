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
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/playlists/import',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
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
					streamValidation: 'verified',
					imported: [
						{
							tidalPlaylistId: 'remote-1',
							status: 'created',
							streamValidation: 'verified',
							tracksSkipped: 0,
							tracksReplaced: 0
						}
					]
				})
			)
			.mockResolvedValueOnce(
				jsonResponse({
					imported: [
						{
							tidalPlaylistId: 'remote-3',
							status: 'created',
							streamValidation: 'verified',
							tracksSkipped: 0,
							tracksReplaced: 0
						}
					]
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
			body: JSON.stringify({ tidalPlaylistIds: ['remote-1'] }),
			signal: expect.any(AbortSignal)
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

	it('reports failed imports without claiming success', async () => {
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

		await expect
			.element(page.getByRole('button', { name: `${m.playlist_import()} (1)` }))
			.toBeEnabled();
		await expect
			.element(page.getByText(m.playlist_import_some_failed({ count: 1 })))
			.toBeInTheDocument();
	});

	it('offers retry when loading playlists fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream failure')));
		render(PlaylistImportModal);
		await expect.element(page.getByText(m.playlist_import_load_failed())).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: m.track_retry() })).toBeInTheDocument();
	});
});

it('continues after one failed playlist and retries only the failed selection', async () => {
	const result = (id: string, status: string) =>
		jsonResponse({
			imported: [
				{
					tidalPlaylistId: id,
					status,
					streamValidation: status === 'created' ? 'verified' : 'deferred',
					tracksSkipped: 0,
					tracksReplaced: 0
				}
			]
		});
	const fetchMock = vi.fn().mockImplementation(async (_url, options) => {
		if (!options?.method) return jsonResponse({ playlists });
		const id = JSON.parse(options.body).tidalPlaylistIds[0];
		return result(id, id === 'remote-1' ? 'error' : 'created');
	});
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(customPlaylists, 'syncWithServer').mockResolvedValue(undefined);
	render(PlaylistImportModal);
	await expect.element(page.getByText('Night Drive')).toBeInTheDocument();
	(
		page.getByRole('button', { name: 'Select all unimported' }).element() as HTMLButtonElement
	).click();
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (2)` }))
		.toBeEnabled();
	(
		page.getByRole('button', { name: `${m.playlist_import()} (2)` }).element() as HTMLButtonElement
	).click();
	await expect
		.element(page.getByText(m.playlist_import_some_failed({ count: 1 })))
		.toBeInTheDocument();
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (1)` }))
		.toBeEnabled();
	const posts = () =>
		fetchMock.mock.calls
			.filter(([, options]) => options?.method === 'POST')
			.map(([, options]) => JSON.parse(options.body).tidalPlaylistIds);
	expect(posts()).toEqual([['remote-1'], ['remote-3']]);
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (1)` }))
		.toBeEnabled();
	(
		page.getByRole('button', { name: `${m.playlist_import()} (1)` }).element() as HTMLButtonElement
	).click();
	await vi.waitFor(() => expect(posts()).toEqual([['remote-1'], ['remote-3'], ['remote-1']]));
});
it('keeps the dialog open during verification and never treats aggregate counts as verified success', async () => {
	let finish!: (value: Response) => void;
	const fetchMock = vi.fn().mockImplementation(async (_url, options) => {
		if (!options?.method) return jsonResponse({ playlists });
		return new Promise<Response>((resolve) => {
			finish = resolve;
		});
	});
	vi.stubGlobal('fetch', fetchMock);
	render(PlaylistImportModal);
	await expect.element(page.getByText('Night Drive')).toBeInTheDocument();
	(page.getByRole('checkbox').nth(0).element() as HTMLInputElement).click();
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (1)` }))
		.toBeEnabled();
	(
		page.getByRole('button', { name: `${m.playlist_import()} (1)` }).element() as HTMLButtonElement
	).click();
	await expect.element(page.getByRole('button', { name: m.action_close() })).toBeDisabled();
	document.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
	);
	await expect.element(page.getByRole('dialog')).toBeInTheDocument();
	finish(jsonResponse({ totalImported: 1, totalErrors: 0 }));
	await expect
		.element(page.getByText(m.playlist_import_some_failed({ count: 1 })))
		.toBeInTheDocument();
	await expect
		.element(page.getByText(m.playlist_import_done(), { exact: false }))
		.not.toBeInTheDocument();
});
it('reconciles a lost final response with the saved copy instead of reimporting it', async () => {
	let posted = false;
	vi.stubGlobal(
		'fetch',
		vi.fn().mockImplementation(async (_url, options) => {
			if (options?.method) {
				posted = true;
				throw new Error('Connection lost after commit');
			}
			return jsonResponse({
				playlists: playlists.map((playlist) => ({
					...playlist,
					isImported: playlist.isImported || (posted && playlist.id === 'remote-1')
				}))
			});
		})
	);
	render(PlaylistImportModal);
	await expect.element(page.getByText('Night Drive')).toBeInTheDocument();
	(page.getByRole('checkbox').nth(0).element() as HTMLInputElement).click();
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (1)` }))
		.toBeEnabled();
	(
		page.getByRole('button', { name: `${m.playlist_import()} (1)` }).element() as HTMLButtonElement
	).click();
	await expect.element(page.getByText(m.playlist_import_saved_found())).toBeInTheDocument();
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (0)` }))
		.toBeDisabled();
	await expect
		.element(page.getByText(m.playlist_import_some_failed({ count: 1 })))
		.not.toBeInTheDocument();
});
it('stops a batch after the current verified playlist and keeps remaining selections', async () => {
	let finish!: (value: Response) => void;
	const fetchMock = vi.fn().mockImplementation(async (_url, options) => {
		if (!options?.method) return jsonResponse({ playlists });
		return new Promise<Response>((resolve) => {
			finish = resolve;
		});
	});
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(customPlaylists, 'syncWithServer').mockResolvedValue(undefined);
	render(PlaylistImportModal);
	await expect.element(page.getByText('Night Drive')).toBeInTheDocument();
	(
		page.getByRole('button', { name: 'Select all unimported' }).element() as HTMLButtonElement
	).click();
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (2)` }))
		.toBeEnabled();
	(
		page.getByRole('button', { name: `${m.playlist_import()} (2)` }).element() as HTMLButtonElement
	).click();
	await expect.element(page.getByRole('button', { name: m.playlist_import_stop() })).toBeEnabled();
	(
		page.getByRole('button', { name: m.playlist_import_stop() }).element() as HTMLButtonElement
	).click();
	finish(
		jsonResponse({
			imported: [
				{
					tidalPlaylistId: 'remote-1',
					status: 'created',
					streamValidation: 'verified',
					tracksSkipped: 0,
					tracksReplaced: 0
				}
			]
		})
	);
	await expect.element(page.getByText(m.playlist_import_stopped())).toBeInTheDocument();
	await expect
		.element(page.getByRole('button', { name: `${m.playlist_import()} (1)` }))
		.toBeEnabled();
	expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});
