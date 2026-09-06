import { describe, expect, it } from 'vitest';
import { MAX_PRIVATE_MUSIC_FILE_BYTES, parsePrivateMusicUpload } from './private-music';

describe('private music upload parsing', () => {
	it('accepts a bounded music file and sanitizes its file name', () => {
		const file = new File(['audio'], '../Demo/Track.flac', { type: 'audio/flac' });
		const parsed = parsePrivateMusicUpload(file);
		expect(parsed).toMatchObject({ success: true, fileName: '.._Demo_Track.flac' });
	});

	it('rejects unsupported and oversized uploads before bucket access', () => {
		expect(
			parsePrivateMusicUpload(new File(['data'], 'notes.txt', { type: 'text/plain' }))
		).toEqual({
			success: false,
			reason: 'type'
		});
		const large = new File(['x'], 'large.flac', { type: 'audio/flac' });
		Object.defineProperty(large, 'size', { value: MAX_PRIVATE_MUSIC_FILE_BYTES + 1 });
		expect(parsePrivateMusicUpload(large)).toEqual({ success: false, reason: 'size' });
	});
});
