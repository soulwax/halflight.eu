import { describe, expect, it } from 'vitest';
import { deriveTasteSignals, readTasteSignals, type TasteSignalReader } from './signals';

const playlistTrack = {
	kind: 'track' as const,
	id: 'track-1',
	title: 'Must not persist',
	artists: [{ id: 'artist-1', name: 'Must not persist' }],
	album: { id: 'album-1', title: 'Must not persist', releaseDate: '1998-10-23' }
};

describe('deriveTasteSignals', () => {
	it('keeps only derived identifiers, source and era from live display models', () => {
		const signals = deriveTasteSignals({
			followedArtists: [{ kind: 'artist', id: 'artist-2', name: 'Must not persist' }],
			playlistTracks: [playlistTrack],
			observedAt: '2026-09-04T00:00:00.000Z'
		});

		expect(signals).toEqual({
			artistSignals: [
				{ artistId: 'artist-2', source: 'followed_artist', observedAt: '2026-09-04T00:00:00.000Z' },
				{ artistId: 'artist-1', source: 'playlist', observedAt: '2026-09-04T00:00:00.000Z' }
			],
			eraSignals: [{ decade: 1990, source: 'playlist', observedAt: '2026-09-04T00:00:00.000Z' }]
		});
	});

	it('ignores display records without durable identifiers or a valid release year', () => {
		const signals = deriveTasteSignals({
			playlistTracks: [
				{ ...playlistTrack, artists: [{ id: '', name: 'Unknown' }], album: { id: 'a', title: 'A' } }
			]
		});

		expect(signals).toEqual({ artistSignals: [], eraSignals: [] });
	});

	it('reads followed artists through an injected live-reader boundary', async () => {
		const reader: TasteSignalReader = {
			getFollowedArtists: async () => [
				{ kind: 'artist', id: 'artist-3', name: 'Display metadata is discarded' }
			]
		};

		const signals = await readTasteSignals({}, reader, new Date('2026-09-04T00:00:00.000Z'));

		expect(signals).toEqual({
			artistSignals: [
				{ artistId: 'artist-3', source: 'followed_artist', observedAt: '2026-09-04T00:00:00.000Z' }
			],
			eraSignals: []
		});
	});
});
