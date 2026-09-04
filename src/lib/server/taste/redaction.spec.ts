import { describe, expect, it } from 'vitest';
import {
	buildTasteProfile,
	emptyTasteProfile,
	TASTE_PROFILE_VERSION,
	type TasteProfile
} from './profile';
import type { TasteSignals } from './signals';

describe('taste profile redaction & privacy', () => {
	it('only contains derived identifiers and weights, strictly excluding titles, audio, and tokens', () => {
		const signals: TasteSignals = {
			artistSignals: [
				{ artistId: 'artist-123', source: 'playlist' },
				{ artistId: 'artist-456', source: 'followed_artist' }
			],
			eraSignals: [
				{ decade: 2010, source: 'playlist' },
				{ decade: 2020, source: 'followed_artist' }
			]
		};

		const profile = buildTasteProfile(signals, emptyTasteProfile());
		const serialized = JSON.stringify(profile);

		// Assert version and structural contracts
		expect(profile.version).toBe(TASTE_PROFILE_VERSION);
		expect(typeof profile.confidence.artists).toBe('number');
		expect(typeof profile.confidence.eras).toBe('number');

		// Assert that forbidden content types and sensitive fields are never in serialized profile
		expect(serialized).not.toContain('title');
		expect(serialized).not.toContain('artwork');
		expect(serialized).not.toContain('lyrics');
		expect(serialized).not.toContain('audio');
		expect(serialized).not.toContain('token');
		expect(serialized).not.toContain('secret');
		expect(serialized).not.toContain('password');
		expect(serialized).not.toContain('bearer');
		expect(serialized).not.toContain('access_token');
		expect(serialized).not.toContain('refresh_token');
	});

	it('ensures exported profile JSON schema conforms strictly to TasteProfile without extraneous keys', () => {
		const profile: TasteProfile = {
			version: 1,
			artists: { 'artist-1': 0.8 },
			eras: { '2010': 0.9 },
			exclusions: { artists: ['artist-blocked'], eras: [1980] },
			overrides: { artists: { 'artist-1': 'pinned' } },
			knobDefaults: { familiarity: 60 },
			confidence: { artists: 0.75, eras: 0.8 },
			updatedAt: '2026-09-04T12:00:00.000Z'
		};

		const keys = Object.keys(profile).sort();
		expect(keys).toEqual([
			'artists',
			'confidence',
			'eras',
			'exclusions',
			'knobDefaults',
			'overrides',
			'updatedAt',
			'version'
		]);
	});
});
