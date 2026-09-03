import { describe, expect, it } from 'vitest';
import { buildM3u, sanitizeFileName, tidalTrackUrl } from './m3u';
import type { TrackSummary } from '#lib/tidal/models';

const tracks: TrackSummary[] = [
	{
		kind: 'track',
		id: 'trk-101',
		title: 'Get Lucky',
		duration: 248.6,
		artists: [
			{ id: 'a1', name: 'Daft Punk' },
			{ id: 'a2', name: 'Pharrell Williams' }
		]
	},
	{ kind: 'track', id: 'trk-102', title: '', duration: 0, artists: [] }
];

describe('buildM3u', () => {
	it('emits the header, a rounded #EXTINF per track, and the supplied URL', () => {
		const lines = buildM3u({ title: 'Mix', tracks, trackUrl: (t) => `x://${t.id}` })
			.trim()
			.split('\n');

		expect(lines).toEqual([
			'#EXTM3U',
			'#PLAYLIST:Mix',
			'#EXTINF:249,Daft Punk, Pharrell Williams - Get Lucky',
			'x://trk-101',
			'#EXTINF:0,Unknown Artist - Unknown Title',
			'x://trk-102'
		]);
	});

	it('omits #PLAYLIST when the title is blank or missing', () => {
		expect(buildM3u({ tracks: [], trackUrl: () => '' })).toBe('#EXTM3U\n');
		expect(buildM3u({ title: '  ', tracks: [], trackUrl: () => '' })).toBe('#EXTM3U\n');
	});
});

describe('tidalTrackUrl', () => {
	it('builds an encoded public track link', () => {
		expect(tidalTrackUrl({ ...tracks[0], id: 'a b' })).toBe('https://tidal.com/browse/track/a%20b');
	});
});

describe('sanitizeFileName', () => {
	it('replaces illegal characters and trims trailing dots', () => {
		expect(sanitizeFileName('Bauhaus: In The Flat Field / 1980?*')).toBe(
			'Bauhaus_ In The Flat Field _ 1980_'
		);
		expect(sanitizeFileName('Track Title...')).toBe('Track Title');
	});

	it('falls back when the result is empty', () => {
		expect(sanitizeFileName('   ')).toBe('untitled');
		expect(sanitizeFileName(null)).toBe('untitled');
		expect(sanitizeFileName('', 'mix')).toBe('mix');
	});
});
