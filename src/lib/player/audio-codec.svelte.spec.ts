import { describe, expect, it } from 'vitest';
import { decodeAudio, encodeWav } from 'bragi-audio/audio';

describe('bragi-audio native browser decoding', () => {
	it('decodes encoded WAV with the real browser decoder and preserves caller bytes', async () => {
		const samples = new Float32Array([-1, -0.5, 0, 0.5, 1]);
		const wav = encodeWav({ sampleRate: 48000, channels: [samples] }, { bitDepth: 24 });
		const original = wav.slice();
		const decoded = await decodeAudio(wav, {
			context: new OfflineAudioContext(1, samples.length, 48000)
		});

		expect(decoded.sampleRate).toBe(48000);
		expect(decoded.numberOfChannels).toBe(1);
		expect(decoded.length).toBe(samples.length);
		for (let i = 0; i < samples.length; i++) {
			expect(decoded.getChannelData(0)[i]).toBeCloseTo(samples[i]!, 5);
		}
		expect(wav).toEqual(original);
	});
});
