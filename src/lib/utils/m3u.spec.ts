import { describe, expect, it } from 'vitest';
import { generateM3u8 } from './m3u';
import type { TrackSummary } from '#lib/tidal/models';

describe('m3u8 playlist generator (translated from tiddl)', () => {
	it('generates valid EXTM3U header and playlist title', () => {
		const result = generateM3u8('My Cool Playlist', []);
		expect(result).toBe('#EXTM3U\n#PLAYLIST:My Cool Playlist\n');
	});

	it('formats track entries with duration, artist, title and URL', () => {
		const mockTracks: TrackSummary[] = [
			{
				kind: 'track',
				id: 'trk-101',
				title: 'Get Lucky',
				duration: 248,
				artists: [
					{ id: 'art-1', name: 'Daft Punk' },
					{ id: 'art-2', name: 'Pharrell Williams' }
				]
			},
			{
				kind: 'track',
				id: 'trk-102',
				title: 'Starboy',
				duration: 230,
				artists: [{ id: 'art-3', name: 'The Weeknd' }]
			}
		];

		const result = generateM3u8('Electronic Hits', mockTracks);
		const lines = result.trim().split('\n');

		expect(lines[0]).toBe('#EXTM3U');
		expect(lines[1]).toBe('#PLAYLIST:Electronic Hits');
		expect(lines[2]).toBe('#EXTINF:248,Daft Punk, Pharrell Williams - Get Lucky');
		expect(lines[3]).toBe('https://tidal.com/browse/track/trk-101');
		expect(lines[4]).toBe('#EXTINF:230,The Weeknd - Starboy');
		expect(lines[5]).toBe('https://tidal.com/browse/track/trk-102');
	});
});
