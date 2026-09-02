import { describe, expect, it } from 'vitest';
import { generateM3u, sanitizeFileName } from './m3u';
import type { TrackSummary } from './models';

describe('m3u module (translated from tiddl)', () => {
	it('sanitizes illegal filename characters and trailing dots', () => {
		expect(sanitizeFileName('Bauhaus: In The Flat Field / 1980?*')).toBe(
			'Bauhaus_ In The Flat Field _ 1980_'
		);
		expect(sanitizeFileName('Track Title...')).toBe('Track Title');
		expect(sanitizeFileName('   ')).toBe('untitled');
		expect(sanitizeFileName(null)).toBe('untitled');
	});

	it('generates standard EXTM3U format', () => {
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

		const m3u = generateM3u({ title: 'Goth Classics', tracks });
		expect(m3u).toContain('#EXTM3U');
		expect(m3u).toContain('#PLAYLIST:Goth Classics');
		expect(m3u).toContain('#EXTINF:576,Bauhaus - Bela Lugosi Is Dead');
		expect(m3u).toContain('https://listen.tidal.com/track/12345');
		expect(m3u).toContain('#EXTINF:345,Bauhaus - She Is In Parties');
		expect(m3u).toContain('https://listen.tidal.com/track/67890');
	});

	it('generates custom baseUrl stream links when requested', () => {
		const tracks: TrackSummary[] = [
			{
				kind: 'track',
				id: '999',
				title: 'Autobahn',
				duration: 1360,
				artists: [{ id: 'a2', name: 'Kraftwerk' }]
			}
		];

		const m3u = generateM3u({
			tracks,
			baseUrl: 'https://syn.bluesix.dev'
		});

		expect(m3u).toContain('https://syn.bluesix.dev/api/tracks/999/stream');
	});
});
