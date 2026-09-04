import { describe, expect, it } from 'vitest';
import type { EphemeralCache } from '#lib/server/cache';
import {
	buildTasteProfile,
	emptyTasteProfile,
	getTasteProfile,
	recencyMultiplier,
	rebuildTasteProfile,
	refreshTasteProfile,
	type TasteProfile,
	type TasteProfileStore
} from './profile';
import type { TasteSignals } from './signals';

const now = new Date('2026-09-04T00:00:00.000Z');

const signals: TasteSignals = {
	artistSignals: [
		{ artistId: 'playlist-artist', source: 'playlist' },
		{ artistId: 'playlist-artist', source: 'playlist' },
		{ artistId: 'followed-artist', source: 'followed_artist' }
	],
	eraSignals: [
		{ decade: 1980, source: 'playlist' },
		{ decade: 1990, source: 'followed_artist' }
	]
};

function memoryStore(): TasteProfileStore {
	const records = new Map<string, TasteProfile>();
	return {
		async read(userId) {
			return records.get(userId) ?? null;
		},
		async write(userId, profile) {
			records.set(userId, profile);
			return profile;
		},
		async delete(userId) {
			records.delete(userId);
		}
	};
}

describe('taste profile', () => {
	it('weights explicit follows above repeated playlist membership without retaining titles', () => {
		const profile = buildTasteProfile(signals, emptyTasteProfile(now), now);

		expect(profile.artists['followed-artist']).toBe(1);
		expect(profile.artists['playlist-artist']).toBeGreaterThan(0);
		expect(profile.eras).toEqual({ '1980': 0.25, '1990': 1 });
		expect(JSON.stringify(profile)).not.toContain('title');
	});

	it('preserves owner exclusions and overrides over fresh inference', () => {
		const previous = emptyTasteProfile(now);
		previous.exclusions.artists = ['followed-artist'];
		previous.overrides.artists = { 'playlist-artist': 'pinned' };
		previous.knobDefaults.familiarity = 72;

		const profile = buildTasteProfile(signals, previous, now);

		expect(profile.artists).toEqual({ 'playlist-artist': 1 });
		expect(profile.knobDefaults).toEqual({ familiarity: 72 });
	});

	it('gives recent evidence a bounded, roughly twofold boost over old evidence', () => {
		expect(recencyMultiplier(now.toISOString(), now)).toBe(2);
		expect(recencyMultiplier('2024-09-04T00:00:00.000Z', now)).toBeCloseTo(1, 3);
	});

	it('rebuilds and persists a profile through an injected store', async () => {
		const profile = await rebuildTasteProfile('owner-1', signals, memoryStore(), now);

		expect(profile.updatedAt).toBe(now.toISOString());
		expect(profile.confidence.artists).toBeGreaterThan(0);
	});

	it('uses a valid cached derived profile before reading the store', async () => {
		const cachedProfile = buildTasteProfile(signals, emptyTasteProfile(now), now);
		const cache: EphemeralCache = {
			get: async () => JSON.stringify(cachedProfile),
			set: async () => {},
			delete: async () => {}
		};
		const store: TasteProfileStore = {
			read: async () => {
				throw new Error('The cached profile should avoid this read.');
			},
			write: async (_userId, profile) => profile,
			delete: async () => {}
		};

		const profile = await getTasteProfile('owner-1', store, cache);

		expect(profile).toEqual(cachedProfile);
	});

	it('replaces an invalid cache entry from the profile store', async () => {
		const profile = buildTasteProfile(signals, emptyTasteProfile(now), now);
		const writes: Array<{ key: string; value: string; ttlSeconds: number }> = [];
		const cache: EphemeralCache = {
			get: async () => '{not JSON',
			set: async (key, value, ttlSeconds) => {
				writes.push({ key, value, ttlSeconds });
			},
			delete: async () => {}
		};
		const store: TasteProfileStore = {
			read: async () => profile,
			write: async (_userId, persisted) => persisted,
			delete: async () => {}
		};

		const result = await getTasteProfile('owner-1', store, cache);

		expect(result).toEqual(profile);
		expect(writes).toEqual([
			{
				key: expect.stringMatching(/^taste-profile:[a-f0-9]{64}$/),
				value: JSON.stringify(profile),
				ttlSeconds: 300
			}
		]);
	});

	it('rebuilds from live signals and bounded playback history without persisting tracks', async () => {
		const profile = await refreshTasteProfile('owner-1', {
			store: memoryStore(),
			reader: {
				getFollowedArtists: async () => [
					{ kind: 'artist', id: 'followed-artist', name: 'Display data is discarded' }
				]
			},
			playbackState: {
				currentTrack: null,
				queue: [],
				history: [
					{
						kind: 'track',
						id: 'session-track',
						title: 'Display data is discarded',
						artists: [{ id: 'session-artist', name: 'Display data is discarded' }]
					}
				],
				currentTime: 0,
				revision: 0,
				lastOrigin: null
			},
			now
		});

		expect(profile.artists).toMatchObject({ 'followed-artist': 1, 'session-artist': 0.5 });
		expect(JSON.stringify(profile)).not.toContain('Display data is discarded');
	});
});
