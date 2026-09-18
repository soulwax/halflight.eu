import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerState } from './player.svelte.js';
import { streamPreloader } from './stream-preloader.js';
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
		const audio = (player as unknown as { audio: FakeAudio }).audio;
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
});
