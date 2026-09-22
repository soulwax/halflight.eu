import { describe, expect, it } from 'vitest';
import {
	MAX_PRIVATE_MUSIC_FILE_BYTES,
	PRIVATE_MUSIC_ACCEPT,
	PRIVATE_MUSIC_CONTENT_TYPES,
	inspectPrivateMusicUpload,
	parsePrivateMusicUpload
} from './private-music';

function wavFile(name = 'tone.wav', type = 'audio/wav'): File {
	const bytes = Uint8Array.from([
		0x52, 0x49, 0x46, 0x46, 44, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 16, 0, 0,
		0, 1, 0, 1, 0, 0x40, 0x1f, 0, 0, 0x40, 0x1f, 0, 0, 1, 0, 8, 0, 0x64, 0x61, 0x74, 0x61, 8, 0, 0,
		0, 128, 144, 160, 144, 128, 112, 96, 112
	]);
	const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
	return new File([buffer], name, { type });
}

describe('private music upload parsing', () => {
	it('accepts a bounded music file and sanitizes its file name', () => {
		const file = new File(['audio'], '../Demo/Track.flac', { type: 'audio/flac' });
		const parsed = parsePrivateMusicUpload(file);
		expect(parsed).toMatchObject({
			success: true,
			upload: { fileName: '.._Demo_Track.flac' }
		});
	});

	it('derives its advertised formats from syn.js', () => {
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

	it('uses detected bytes for the stored type and rejects misleading hints', async () => {
		const accepted = parsePrivateMusicUpload(wavFile());
		if (!accepted.success)
			throw new Error('The synthetic WAV should pass basic upload validation.');
		await expect(inspectPrivateMusicUpload(accepted.upload)).resolves.toMatchObject({
			success: true,
			contentType: 'audio/wav',
			bytes: expect.any(Uint8Array)
		});

		const renamed = parsePrivateMusicUpload(wavFile('tone.mp3', 'audio/mpeg'));
		if (!renamed.success) throw new Error('The synthetic WAV should reach byte inspection.');
		await expect(inspectPrivateMusicUpload(renamed.upload)).resolves.toEqual({
			success: false,
			reason: 'type'
		});
	});

	it('rejects malformed and oversized uploads before bucket access', async () => {
		const malformed = parsePrivateMusicUpload(
			new File(['data'], 'notes.txt', { type: 'text/plain' })
		);
		if (!malformed.success) throw new Error('A bounded file should reach byte inspection.');
		await expect(inspectPrivateMusicUpload(malformed.upload)).resolves.toEqual({
			success: false,
			reason: 'type'
		});
		const large = new File(['x'], 'large.flac', { type: 'audio/flac' });
		Object.defineProperty(large, 'size', { value: MAX_PRIVATE_MUSIC_FILE_BYTES + 1 });
		expect(parsePrivateMusicUpload(large)).toEqual({ success: false, reason: 'size' });
	});
});
