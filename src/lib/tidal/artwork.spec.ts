import { describe, expect, it } from 'vitest';
import { artworkUrlForSize, trackArtworkUrl } from './artwork';

describe('display artwork URLs', () => {
	it('lets a missing numeric TIDAL cover load directly at thumbnail size', () => {
		expect(trackArtworkUrl({ id: '123' }, 80)).toBe('/api/tracks/123/artwork?size=80');
		expect(trackArtworkUrl({ id: '123' })).toBe('/api/tracks/123/artwork');
	});
	it('uses one thumbnail URL for different tracks on the same album', () => {
		const album = { id: '456', title: 'Album' };
		expect(trackArtworkUrl({ id: '123', album }, 80)).toBe('/api/albums/456/artwork?size=80');
		expect(trackArtworkUrl({ id: '124', album }, 80)).toBe(
			trackArtworkUrl({ id: '123', album }, 80)
		);
		expect(artworkUrlForSize('/api/albums/456/artwork?size=80', 640)).toBe(
			'/api/albums/456/artwork'
		);
	});
	it('keeps a track’s canonical artwork when album data arrives later', () => {
		const album = { id: '456', title: 'Album' };
		// Without album data the track proxy is canonical; once written to imageUrl
		// it must not turn into the album URL, which would reload the same cover.
		const canonical = trackArtworkUrl({ id: '123' });
		expect(canonical).toBe('/api/tracks/123/artwork');
		expect(trackArtworkUrl({ id: '123', album, imageUrl: canonical ?? undefined })).toBe(canonical);
		expect(trackArtworkUrl({ id: '123', album, imageUrl: canonical ?? undefined }, 80)).toBe(
			'/api/tracks/123/artwork?size=80'
		);
	});
	it('prefers catalogue images, which work without the playback token', () => {
		const album = {
			id: '456',
			title: 'Album',
			imageUrl: 'https://resources.tidal.com/images/a0/640x640.jpg'
		};
		expect(trackArtworkUrl({ id: '123', album }, 80)).toBe(
			'https://resources.tidal.com/images/a0/80x80.jpg'
		);
	});
	it('does not send private or unresolved identifiers to TIDAL', () => {
		expect(trackArtworkUrl({ id: 'private-file' })).toBeNull();
		expect(trackArtworkUrl(null)).toBeNull();
	});
	it('uses supplied album artwork and preserves arbitrary image URLs', () => {
		expect(
			trackArtworkUrl(
				{ id: '123', album: { id: 'a', title: 'Album', imageUrl: 'https://image.test/cover.jpg' } },
				80
			)
		).toBe('https://image.test/cover.jpg');
		expect(artworkUrlForSize('https://other.test/api/tracks/123/artwork', 80)).toBe(
			'https://other.test/api/tracks/123/artwork'
		);
	});
	it('resizes existing local artwork without appending duplicate size parameters', () => {
		expect(artworkUrlForSize('/api/tracks/123/artwork?size=80', 320)).toBe(
			'/api/tracks/123/artwork?size=320'
		);
		expect(artworkUrlForSize('/api/tracks/123/artwork?size=320', 640)).toBe(
			'/api/tracks/123/artwork'
		);
	});
	it('resizes canonical public TIDAL images without changing unrelated URLs', () => {
		expect(artworkUrlForSize('https://resources.tidal.com/images/a0b1/e4f5/640x640.jpg', 80)).toBe(
			'https://resources.tidal.com/images/a0b1/e4f5/80x80.jpg'
		);
		expect(
			artworkUrlForSize('https://resources.tidal.com.example/images/a0b1/640x640.jpg', 80)
		).toBe('https://resources.tidal.com.example/images/a0b1/640x640.jpg');
	});
});
