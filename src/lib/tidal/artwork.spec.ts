import { describe, expect, it } from 'vitest';
import { artworkUrlForSize, trackArtworkUrl } from './artwork';

describe('display artwork URLs', () => {
	it('lets a missing numeric TIDAL cover load directly at thumbnail size', () => {
		expect(trackArtworkUrl({ id: '123' }, 80)).toBe('/api/tracks/123/artwork?size=80');
		expect(trackArtworkUrl({ id: '123' })).toBe('/api/tracks/123/artwork');
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
