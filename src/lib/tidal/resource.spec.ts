import { describe, expect, it } from 'vitest';
import { parseTidalResource } from './resource';

describe('resource module (translated from tiddl)', () => {
	it('parses full TIDAL web and browse URLs', () => {
		const trackRes = parseTidalResource('https://listen.tidal.com/track/77814841');
		expect(trackRes).toEqual({
			type: 'track',
			id: '77814841',
			url: 'https://listen.tidal.com/track/77814841',
			appPath: '/app/tracks/77814841'
		});

		const albumRes = parseTidalResource('https://tidal.com/browse/album/1054321');
		expect(albumRes).toEqual({
			type: 'album',
			id: '1054321',
			url: 'https://listen.tidal.com/album/1054321',
			appPath: '/app/albums/1054321'
		});

		const playlistRes = parseTidalResource(
			'https://listen.tidal.com/playlist/788c0a80-36b0-4660-84cf-cf511a3b118b'
		);
		expect(playlistRes).toEqual({
			type: 'playlist',
			id: '788c0a80-36b0-4660-84cf-cf511a3b118b',
			url: 'https://listen.tidal.com/playlist/788c0a80-36b0-4660-84cf-cf511a3b118b',
			appPath: '/app/playlists/788c0a80-36b0-4660-84cf-cf511a3b118b'
		});
	});

	it('parses shorthand resource strings', () => {
		const artistRes = parseTidalResource('artist/3521');
		expect(artistRes).toEqual({
			type: 'artist',
			id: '3521',
			url: 'https://listen.tidal.com/artist/3521',
			appPath: '/app/artists/3521'
		});

		const mixRes = parseTidalResource('mix/00139b4b6058b760baea5be415f3a0');
		expect(mixRes).toEqual({
			type: 'mix',
			id: '00139b4b6058b760baea5be415f3a0',
			url: 'https://listen.tidal.com/mix/00139b4b6058b760baea5be415f3a0',
			appPath: '/app/mixes?mixId=00139b4b6058b760baea5be415f3a0'
		});
	});

	it('returns null for invalid strings', () => {
		expect(parseTidalResource('')).toBeNull();
		expect(parseTidalResource('random search text')).toBeNull();
		expect(parseTidalResource('https://google.com')).toBeNull();
		expect(parseTidalResource('track/not-a-number')).toBeNull();
	});
});
