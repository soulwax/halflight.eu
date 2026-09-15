import { describe, expect, it } from 'vitest';
import {
	MAX_PRIVATE_MUSIC_FILE_BYTES,
	PRIVATE_MUSIC_ACCEPT,
	PRIVATE_MUSIC_CONTENT_TYPES,
	parsePrivateMusicUpload
} from './private-music';

describe('private music upload parsing', () => {
	it('accepts a bounded music file and sanitizes its file name', () => {
		const file = new File(['audio'], '../Demo/Track.flac', { type: 'audio/flac' });
		const parsed = parsePrivateMusicUpload(file);
		expect(parsed).toMatchObject({ success: true, fileName: '.._Demo_Track.flac' });
	});

	it('normalizes supported browser MIME aliases and empty MIME metadata to canonical types', () => {
		expect(parsePrivateMusicUpload(new File(['audio'], 'mix.mp3', { type: '' }))).toMatchObject({
			success: true,
			contentType: 'audio/mpeg'
		});
		expect(
			parsePrivateMusicUpload(new File(['audio'], 'album.m4a', { type: 'audio/x-m4a' }))
		).toMatchObject({
			success: true,
			contentType: 'audio/mp4'
		});
		expect(PRIVATE_MUSIC_CONTENT_TYPES).toEqual(
			new Set([
				'audio/mpeg',
				'audio/flac',
				'audio/aac',
				'audio/mp4',
				'audio/ogg',
				'audio/wav',
				'audio/webm'
			])
		);
		expect(PRIVATE_MUSIC_ACCEPT).toContain('.flac');
	});

	it('rejects an upload whose recognised MIME type contradicts its extension', () => {
		expect(
			parsePrivateMusicUpload(new File(['audio'], 'not-an-mp3.mp3', { type: 'audio/flac' }))
		).toEqual({
			success: false,
			reason: 'type'
		});
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
