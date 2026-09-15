import { describe, expect, it } from 'vitest';
import { privateMusicAccept, privateMusicDownloadUrl } from './private-music';

describe('private music client helpers', () => {
	it('derives a file-picker accept value and explicit download route from safe API data', () => {
		const file = {
			id: 'private-1',
			fileName: 'Demo.flac',
			contentType: 'audio/flac',
			sizeBytes: 42,
			createdAt: '2026-09-15T00:00:00.000Z',
			downloadUrl: '/api/private-music/private-1'
		};
		expect(
			privateMusicAccept([{ label: 'MP3', contentType: 'audio/mpeg', extensions: ['mp3'] }])
		).toBe('.mp3');
		expect(privateMusicDownloadUrl(file)).toBe('/api/private-music/private-1?download=1');
	});
});
