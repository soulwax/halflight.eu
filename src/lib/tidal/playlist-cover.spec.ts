import { describe, expect, it } from 'vitest';
import { playlistCoverTracks } from './playlist-cover';
const track = (id: string, album: string) => ({
	kind: 'track' as const,
	id,
	title: id,
	artists: [],
	album: { kind: 'album' as const, id: album, title: album, artists: [] }
});
describe('playlist album covers', () => {
	it('selects the first four distinct albums in playlist order', () => {
		const tracks = [
			track('1', 'a'),
			track('2', 'a'),
			track('3', 'b'),
			track('4', 'c'),
			track('5', 'd'),
			track('6', 'e')
		];
		expect(playlistCoverTracks(tracks).map((item) => item.id)).toEqual(['1', '3', '4', '5']);
	});
	it('uses the first album for fewer than four albums and handles empty playlists', () => {
		expect(playlistCoverTracks([track('1', 'a'), track('2', 'b')]).map((item) => item.id)).toEqual([
			'1'
		]);
		expect(playlistCoverTracks([])).toEqual([]);
	});
});
