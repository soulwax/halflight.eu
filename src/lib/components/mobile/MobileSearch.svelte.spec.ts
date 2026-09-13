import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import { player } from '#lib/player/player.svelte.js';
import MobileSearch from './MobileSearch.svelte';

const mocks = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	mocks.goto.mockReset();
	player.currentTrack = null;
	player.queue = [];
	player.history = [];
});

describe('MobileSearch.svelte', () => {
	const track = {
		kind: 'track' as const,
		id: '1',
		title: 'Recovered track',
		artists: [{ id: 'a', name: 'Artist' }]
	};
	const resultsResponse = () =>
		Response.json({ results: { tracks: [track], albums: [], artists: [], playlists: [] } });

	it('retries the same failed query and clears the old error', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 502 }))
			.mockImplementationOnce(resultsResponse);
		vi.stubGlobal('fetch', fetchMock);
		render(MobileSearch);
		await page.getByRole('searchbox').fill('recover');
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.now_search_unavailable());
		await page.getByRole('button', { name: m.track_retry(), exact: true }).click();
		await expect.element(page.getByText(track.title)).toBeInTheDocument();
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'/api/search?q=recover',
			'/api/search?q=recover'
		]);
	});

	it('keeps the active query in the URL without moving focus or scrolling', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(resultsResponse));
		render(MobileSearch);

		await page.getByRole('searchbox').fill('url backed');
		const [url, options] = mocks.goto.mock.calls[0] ?? [];
		expect(new URL(String(url)).searchParams.get('q')).toBe('url backed');
		expect(options).toMatchObject({
			replace: true,
			reset: false,
			shallow: true
		});
	});

	it('restores a query when browser history changes', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(resultsResponse));
		const originalUrl = window.location.href;
		const restoredUrl = new URL(originalUrl);
		restoredUrl.searchParams.set('q', 'history query');
		const screen = render(MobileSearch);

		window.history.replaceState(window.history.state, '', restoredUrl);
		window.dispatchEvent(new PopStateEvent('popstate'));
		await expect.element(page.getByRole('searchbox')).toHaveValue('history query');

		screen.unmount();
		window.history.replaceState(window.history.state, '', originalUrl);
		expect(mocks.goto).not.toHaveBeenCalled();
	});

	it('turns a stalled search into a retryable failure', async () => {
		const deadline = new AbortController();
		vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
		const fetchMock = vi.fn(
			(_url: string, init: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
				})
		);
		vi.stubGlobal('fetch', fetchMock);
		render(MobileSearch);
		await page.getByRole('searchbox').fill('slow');
		await expect.poll(() => fetchMock.mock.calls.length).toBe(1);
		deadline.abort(new DOMException('Timed out', 'TimeoutError'));
		await expect.element(page.getByRole('button', { name: m.track_retry() })).toBeInTheDocument();
		await expect.element(page.getByText(m.search_live_searching())).not.toBeInTheDocument();
		expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
	});

	it.each([401, 503])('offers a recovery link for status %s', async (status) => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
		render(MobileSearch);
		await page.getByRole('searchbox').fill('test');
		const link = page.getByRole('link', {
			name: status === 401 ? m.sign_in_button() : m.tidal_connect()
		});
		await expect
			.element(link)
			.toHaveAttribute('href', status === 401 ? '/sign-in' : '/app/settings/tidal');
	});

	it.each(['cancel', 'unmount', 'new-track'] as const)(
		'ignores late radio after %s',
		async (action) => {
			let resolveRadio!: (response: Response) => void;
			let radioSignal: AbortSignal | null | undefined;
			const fetchMock = vi.fn((url: string, init?: RequestInit) => {
				if (url.startsWith('/api/search')) return Promise.resolve(resultsResponse());
				radioSignal = init?.signal;
				return new Promise<Response>((resolve) => {
					resolveRadio = resolve;
				});
			});
			vi.stubGlobal('fetch', fetchMock);
			const play = vi.spyOn(player, 'play').mockImplementation(() => {});
			const screen = render(MobileSearch);
			await page.getByRole('searchbox').fill('radio');
			await page.getByRole('button', { name: m.track_action_menu() }).click();
			await page.getByRole('menuitem', { name: m.track_action_start_radio() }).click();
			await expect.element(page.getByText(m.player_starting_radio())).toBeInTheDocument();
			if (action === 'cancel')
				await page.getByRole('button', { name: m.playlist_cancel() }).click();
			else if (action === 'unmount') await screen.unmount();
			else player.currentTrack = { ...track, id: 'newer' };
			const response = Response.json({ tracks: [track] });
			const json = vi.spyOn(response, 'json');
			resolveRadio(response);
			await expect.poll(() => json.mock.results.length).toBe(1);
			await json.mock.results[0].value;
			expect(play).not.toHaveBeenCalled();
			if (action !== 'new-track') expect(radioSignal?.aborted).toBe(true);
		}
	);

	it('keeps newer results when an older mobile query resolves late', async () => {
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
		render(MobileSearch);

		const input = page.getByRole('searchbox', { name: 'Search your music' });
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
		await expect.element(page.getByText('First result')).not.toBeInTheDocument();
	});

	it('keeps one primary track action and moves the queue verbs into a menu', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						results: {
							tracks: [
								{
									kind: 'track',
									id: 'track-1',
									title: 'Mobile Track',
									artists: [{ id: 'artist-1', name: 'Mobile Artist' }]
								}
							],
							albums: [],
							artists: [],
							playlists: []
						}
					})
				)
			)
		);
		render(MobileSearch);

		const input = page.getByRole('searchbox', { name: 'Search your music' });
		await input.fill('mobile');
		await expect.element(page.getByText('Mobile Track')).toBeInTheDocument();

		const menu = page.getByRole('button', { name: m.track_action_menu() });
		await expect.element(menu).toBeInTheDocument();
		await menu.click();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_play_now(), exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_play_next(), exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_add_to_queue(), exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_start_radio(), exact: true }))
			.toBeInTheDocument();

		await page.getByRole('menuitem', { name: m.track_action_play_now() }).click();
		expect(play).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'track-1' }),
			expect.arrayContaining([expect.objectContaining({ id: 'track-1' })]),
			expect.any(String)
		);
	});
});
