import { describe, expect, it } from 'vitest';
import { generateM3u } from './m3u';
import type { TrackSummary } from '#lib/tidal/models';

const tracks: TrackSummary[] = [
	{
		kind: 'track',
		id: '12345',
		title: 'Bela Lugosi Is Dead',
		duration: 576,
		artists: [{ id: 'a1', name: 'Bauhaus' }]
	},
	{
		kind: 'track',
		id: '67890',
		title: 'She Is In Parties',
		duration: 345,
		artists: [{ id: 'a1', name: 'Bauhaus' }]
	}
];

describe('generateM3u', () => {
	it('links to listen.tidal.com by default', () => {
		const m3u = generateM3u({ title: 'Goth Classics', tracks });

		expect(m3u).toContain('#EXTM3U');
		expect(m3u).toContain('#PLAYLIST:Goth Classics');
		expect(m3u).toContain('#EXTINF:576,Bauhaus - Bela Lugosi Is Dead');
		expect(m3u).toContain('https://listen.tidal.com/track/12345');
		expect(m3u).toContain('https://listen.tidal.com/track/67890');
	});

	it('links to the authenticated stream proxy when a baseUrl is given', () => {
		const m3u = generateM3u({ tracks: tracks.slice(0, 1), baseUrl: 'https://syn.bluesix.dev/' });

		expect(m3u).toContain('https://syn.bluesix.dev/api/tracks/12345/stream');
		expect(m3u).not.toContain('#PLAYLIST');
	});
});
