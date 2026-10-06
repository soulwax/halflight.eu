import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerState } from './player.svelte.js';
import { streamLoader, streamPreloader } from './stream-preloader.js';
import type { TrackSummary } from '#lib/tidal/models';

class FakeAudio {
	static instances: FakeAudio[] = [];
	preload = '';
	paused = true;
	currentTime = 0;
	duration = 180;
	src = '';
	private listeners = new Map<string, Array<() => void>>();

	constructor() {
		FakeAudio.instances.push(this);
	}

	setAttribute(): void {}

	addEventListener(name: string, listener: () => void): void {
		const listeners = this.listeners.get(name) ?? [];
		listeners.push(listener);
		this.listeners.set(name, listeners);
	}

	dispatch(name: string): void {
		for (const listener of this.listeners.get(name) ?? []) listener();
	}

	play(): Promise<void> {
		this.paused = false;
		return Promise.resolve();
	}

	pause(): void {
		this.paused = true;
	}
}

const track = (id: string): TrackSummary => ({
	kind: 'track',
	id,
	title: `Track ${id}`,
	duration: 180,
	imageUrl: `https://img.test/${id}.jpg`,
	artists: [{ id: 'artist-1', name: 'Artist One' }]
});

function streamResponse(): Response {
	return new Response(JSON.stringify({ audioQuality: 'HIGH' }), { status: 200 });
}

beforeEach(() => {
	localStorage.clear();
	FakeAudio.instances = [];
	streamPreloader.clear();
	vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
	localStorage.clear();
	streamPreloader.clear();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('PlayerState browser playback', () => {
	it('cancels the old stream load and ignores its late authentication failure', async () => {
		let finish: (result: Awaited<ReturnType<typeof streamLoader.load>>) => void = () => {};
		const pending = new Promise<Awaited<ReturnType<typeof streamLoader.load>>>((resolve) => {
			finish = resolve;
		});
		const load = vi
			.spyOn(streamLoader, 'load')
			.mockReturnValueOnce(pending)
			.mockResolvedValueOnce({ ok: true, data: { audioQuality: 'HIGH' } });
		const player = new PlayerState();
		player.play(track('one'));
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
		const signal = load.mock.calls[0][1];
		player.play(track('two'));
		await vi.waitFor(() => expect(player.streamUrl).toBe('/api/tracks/two/audio'));
		finish({ ok: false, status: 403, reason: 'not_linked', requiresAuth: true });
		await pending;

		expect(signal?.aborted).toBe(true);
		expect(player.requiresFullAuth).toBe(false);
		expect(player.playbackReason).toBeNull();
		expect(player.currentTrack?.id).toBe('two');
	});
	it('skips to the next queue item when the audio element ends', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) =>
				String(url).endsWith('/stream')
					? Promise.resolve(streamResponse())
					: Promise.reject(new Error('not needed'))
			)
		);
		const player = new PlayerState();
		player.play(track('one'));
		player.addToQueue(track('two'));

		await vi.waitFor(() => expect(player.streamUrl).toBe('/api/tracks/one/audio'));
		const [audio] = FakeAudio.instances;
		audio.dispatch('ended');

		expect(player.currentTrack?.id).toBe('two');
		expect(player.queue).toHaveLength(0);
		expect(player.history.map((item) => item.id)).toEqual(['one']);
	});

	it('ignores a late stream response after skipping to another track', async () => {
		let resolveFirst: ((response: Response) => void) | undefined;
		const fetchMock = vi.fn((url: string) => {
			if (!String(url).endsWith('/stream')) return Promise.reject(new Error('not needed'));
			if (String(url).includes('/one/')) {
				return new Promise<Response>((resolve) => {
					resolveFirst = resolve;
				});
			}
			return Promise.resolve(streamResponse());
		});
		vi.stubGlobal('fetch', fetchMock);

		const player = new PlayerState();
		player.play(track('one'));
		player.play(track('two'));

		await vi.waitFor(() => expect(player.streamUrl).toBe('/api/tracks/two/audio'));
		expect(player.currentTrack?.id).toBe('two');

		resolveFirst?.(streamResponse());
		await Promise.resolve();
		await Promise.resolve();

		expect(player.currentTrack?.id).toBe('two');
		expect(player.streamUrl).toBe('/api/tracks/two/audio');
		expect(fetchMock).toHaveBeenCalled();
	});

	it('does not resurrect a stream after the player is closed', async () => {
		let resolveStream: ((response: Response) => void) | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) => {
				if (!String(url).endsWith('/stream')) return Promise.reject(new Error('not needed'));
				return new Promise<Response>((resolve) => {
					resolveStream = resolve;
				});
			})
		);

		const player = new PlayerState();
		player.play(track('one'));
		player.close();
		resolveStream?.(streamResponse());
		await Promise.resolve();
		await Promise.resolve();

		expect(player.currentTrack).toBeNull();
		expect(player.streamUrl).toBeNull();
		expect(player.isPlaying).toBe(false);
	});

	it.each(['skip', 'close'] as const)(
		'aborts a joined look-ahead fetch when foreground playback is canceled by %s',
		async (cancellation) => {
			let preloadSignal: AbortSignal | null = null;
			const fetchMock = vi.fn((url: string, init?: RequestInit) => {
				if (String(url).includes('/lookahead/stream')) {
					preloadSignal = init?.signal ?? null;
					return new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener(
							'abort',
							() => reject(new DOMException('Aborted', 'AbortError')),
							{ once: true }
						);
					});
				}
				return Promise.resolve(streamResponse());
			});
			vi.stubGlobal('fetch', fetchMock);

			const player = new PlayerState();
			player.currentTrack = track('current');
			player.addToQueue(track('lookahead'));
			await vi.waitFor(() =>
				expect(fetchMock).toHaveBeenCalledWith(
					'/api/tracks/lookahead/stream',
					expect.objectContaining({ signal: expect.any(AbortSignal) })
				)
			);
			expect((preloadSignal as AbortSignal | null)?.aborted).toBe(false);

			player.playFromQueue(player.queue[0].entryId);
			if (cancellation === 'skip') player.play(track('other'));
			else player.close();

			await vi.waitFor(() => expect((preloadSignal as AbortSignal | null)?.aborted).toBe(true));
		}
	);
});

describe('deliberate resume and retry', () => {
	it('starts the restored position once, keeps the queue and ignores duplicate taps', async () => {
		const load = vi
			.spyOn(streamLoader, 'load')
			.mockResolvedValue({ ok: true, data: { audioQuality: 'HIGH' } });
		const player = new PlayerState();
		player.currentTrack = track('saved');
		player.currentTime = 42;
		player.addToQueue(track('next'));
		expect(FakeAudio.instances.every((audio) => audio.paused)).toBe(true);
		expect(load.mock.calls.filter(([id]) => id === 'saved')).toHaveLength(0);
		player.resumePlayback();
		player.resumePlayback();
		await vi.waitFor(() => expect(player.isLoading).toBe(false));
		expect(load.mock.calls.filter(([id]) => id === 'saved')).toHaveLength(1);
		expect(player.currentTrack?.id).toBe('saved');
		expect(player.currentTime).toBe(42);
		expect(player.queue[0]?.id).toBe('next');
		expect(FakeAudio.instances[0]?.paused).toBe(false);
		player.pausePlayback();
		player.resumePlayback();
		await vi.waitFor(() => expect(player.isLoading).toBe(false));
		expect(load.mock.calls.filter(([id]) => id === 'saved')).toHaveLength(1);
		expect(player.isPlaying).toBe(true);
		expect(player.currentTime).toBe(42);
		player.close();
	});
	it('retries fallback at the accepted position without replacing the session', async () => {
		vi.spyOn(streamLoader, 'load').mockResolvedValue({ ok: true, data: { audioQuality: 'HIGH' } });
		const player = new PlayerState();
		player.currentTrack = track('saved');
		player.currentTime = 42;
		player.playbackMode = 'embed';
		player.addToQueue(track('next'));
		const queueId = player.queue[0].entryId;
		player.retryPlayback();
		await vi.waitFor(() => expect(player.isLoading).toBe(false));
		expect(player.playbackMode).toBe('direct');
		expect(player.currentTime).toBe(42);
		expect(player.queue[0].entryId).toBe(queueId);
		expect(FakeAudio.instances[0]?.paused).toBe(false);
		player.close();
	});
});
