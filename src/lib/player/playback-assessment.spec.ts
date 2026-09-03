import { describe, expect, it } from 'vitest';
import { assessPlayback } from './playback-assessment';

describe('assessPlayback — length', () => {
	it('is unknown until both durations are known', () => {
		expect(assessPlayback({ actualSeconds: 200 }).length).toBe('unknown');
		expect(assessPlayback({ expectedSeconds: 200 }).length).toBe('unknown');
		expect(assessPlayback({}).ok).toBe(true);
	});

	it('accepts a stream within tolerance of the catalogue length', () => {
		const a = assessPlayback({ expectedSeconds: 204, actualSeconds: 203.4 });
		expect(a.length).toBe('match');
		expect(a.ok).toBe(true);
		expect(a.warning).toBeNull();
		expect(a.lengthRatio).toBeCloseTo(203.4 / 204);
	});

	it('flags a 30s clip against a full track as a preview', () => {
		const a = assessPlayback({ expectedSeconds: 204, actualSeconds: 30.1 });
		expect(a.isLikelyPreview).toBe(true);
		expect(a.length).toBe('short');
		expect(a.ok).toBe(false);
		expect(a.warning).toBe('Preview only — 0:30 of 3:24');
	});

	it('flags a merely short stream without calling it a preview', () => {
		const a = assessPlayback({ expectedSeconds: 200, actualSeconds: 150 });
		expect(a.isLikelyPreview).toBe(false);
		expect(a.length).toBe('short');
		expect(a.warning).toBe('Stream is short — 2:30 of 3:20');
	});

	it('flags a stream that runs past the catalogue length', () => {
		const a = assessPlayback({ expectedSeconds: 180, actualSeconds: 420 });
		expect(a.length).toBe('long');
		expect(a.warning).toContain('past the catalogue length');
	});

	it('ignores zero / non-finite durations', () => {
		expect(assessPlayback({ expectedSeconds: 0, actualSeconds: 200 }).length).toBe('unknown');
		expect(assessPlayback({ expectedSeconds: 200, actualSeconds: Infinity }).length).toBe(
			'unknown'
		);
		expect(assessPlayback({ expectedSeconds: 200, actualSeconds: NaN }).length).toBe('unknown');
	});
});

describe('assessPlayback — quality', () => {
	it('reports a downgrade when the delivered tier is lower than requested', () => {
		const a = assessPlayback({
			requestedQuality: 'LOSSLESS',
			deliveredQuality: 'HIGH',
			codecs: 'mp4a.40.2'
		});
		expect(a.downgraded).toBe(true);
		expect(a.lossless).toBe(false);
		expect(a.warning).toBe('Quality: asked LOSSLESS, got HIGH');
	});

	it('is happy when the delivered tier meets or beats the request', () => {
		expect(
			assessPlayback({ requestedQuality: 'high', deliveredQuality: 'LOSSLESS' }).downgraded
		).toBe(false);
		expect(assessPlayback({ requestedQuality: 'HIGH', deliveredQuality: 'HIGH' }).ok).toBe(true);
	});

	it('marks FLAC delivery as lossless', () => {
		expect(assessPlayback({ deliveredQuality: 'LOSSLESS', codecs: 'flac' }).lossless).toBe(true);
	});

	it('does not guess when a tier is missing or unrecognised', () => {
		expect(assessPlayback({ deliveredQuality: 'HIGH' }).downgraded).toBe(false);
		expect(assessPlayback({ requestedQuality: 'WEIRD', deliveredQuality: 'LOW' }).downgraded).toBe(
			false
		);
	});

	it('combines a length and a quality issue into one warning line', () => {
		const a = assessPlayback({
			expectedSeconds: 200,
			actualSeconds: 150,
			requestedQuality: 'LOSSLESS',
			deliveredQuality: 'LOW'
		});
		expect(a.warning).toBe('Stream is short — 2:30 of 3:20 · Quality: asked LOSSLESS, got LOW');
	});
});

describe('assessPlayback — embed mode', () => {
	it('asserts nothing about the black-box embed player', () => {
		const a = assessPlayback({
			mode: 'embed',
			expectedSeconds: 204,
			actualSeconds: 30,
			requestedQuality: 'LOSSLESS',
			deliveredQuality: 'LOW'
		});
		expect(a.ok).toBe(true);
		expect(a.warning).toBeNull();
		// raw facts are still computed for display
		expect(a.isLikelyPreview).toBe(true);
		expect(a.downgraded).toBe(true);
	});
});
