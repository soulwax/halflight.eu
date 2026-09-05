import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HeaderSearch from './HeaderSearch.svelte';

const mocks = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

afterEach(() => {
	vi.unstubAllGlobals();
	mocks.goto.mockReset();
});

describe('HeaderSearch.svelte', () => {
	it('ignores a late result from an aborted query', async () => {
		const pending: Array<{ resolve: (response: Response) => void }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						pending.push({ resolve });
					})
			)
		);
		render(HeaderSearch);

		const input = page.getByRole('combobox', { name: 'Search Halflight' });
		await input.fill('first');
		await expect.poll(() => pending.length).toBe(1);
		await input.fill('second');
		await expect.poll(() => pending.length).toBe(2);

		pending[1]?.resolve(
			new Response(
				JSON.stringify({
					results: {
						tracks: [{ kind: 'track', id: 'second', title: 'Second result', artists: [] }],
						albums: [],
						artists: [],
						playlists: []
					}
				})
			)
		);
		await expect.element(page.getByText('Second result')).toBeInTheDocument();

		pending[0]?.resolve(
			new Response(
				JSON.stringify({
					results: {
						tracks: [{ kind: 'track', id: 'first', title: 'First result', artists: [] }],
						albums: [],
						artists: [],
						playlists: []
					}
				})
			)
		);
		await expect.element(page.getByText('Second result')).toBeInTheDocument();
		await expect.element(page.getByText('First result')).not.toBeInTheDocument();
	});

	it('does not replace newer results when an earlier query fails late', async () => {
		const pending: Array<{
			resolve: (response: Response) => void;
			reject: (error: Error) => void;
		}> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise<Response>((resolve, reject) => {
						pending.push({ resolve, reject });
					})
			)
		);
		render(HeaderSearch);

		const input = page.getByRole('combobox', { name: 'Search Halflight' });
		await input.fill('first');
		await expect.poll(() => pending.length).toBe(1);
		await input.fill('second');
		await expect.poll(() => pending.length).toBe(2);

		pending[1]?.resolve(
			new Response(
				JSON.stringify({
					results: {
						tracks: [{ kind: 'track', id: 'second', title: 'Second result', artists: [] }],
						albums: [],
						artists: [],
						playlists: []
					}
				})
			)
		);
		await expect.element(page.getByText('Second result')).toBeInTheDocument();

		pending[0]?.reject(new Error('Network failed'));
		await expect.element(page.getByText('Second result')).toBeInTheDocument();
	});

	it('shows grouped results and opens the highlighted result with the keyboard', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					results: {
						tracks: [
							{
								kind: 'track',
								id: 'track-1',
								title: 'Header Track',
								artists: [{ id: 'artist-1', name: 'Header Artist' }]
							}
						],
						albums: [],
						artists: [],
						playlists: []
					}
				})
			)
		);
		vi.stubGlobal('fetch', fetchMock);
		render(HeaderSearch);

		const input = page.getByRole('combobox', { name: 'Search Halflight' });
		await input.fill('head');
		await expect.poll(() => fetchMock.mock.calls.length).toBe(1);
		await expect.element(page.getByRole('option', { name: /Header Track/ })).toBeInTheDocument();

		input
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		input.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		expect(mocks.goto).toHaveBeenCalledWith('/app/tracks/track-1');
	});
});
