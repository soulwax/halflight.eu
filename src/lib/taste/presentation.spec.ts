import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import {
	localizeDurationCoverage,
	localizeProvenanceReason,
	localizeSetDuration,
	localizeSetSummary
} from './presentation';

describe('generated set presentation', () => {
	it('localizes structured provenance only at the client-safe presentation boundary', () => {
		expect(
			localizeProvenanceReason({
				code: 'similar_artist',
				seedArtistId: 'artist-1',
				seedArtistName: 'Bauhaus',
				releaseYear: '1982'
			})
		).toBe(`${m.taste_provenance_similar({ seed: 'Bauhaus' })} · 1982`);
	});

	it('clearly labels an estimated duration and reports its coverage', () => {
		const set = {
			trackCount: 4,
			estimatedDurationSeconds: 900,
			unknownDurationCount: 1,
			discoveryPercentage: 25,
			confidenceLabel: 'good' as const
		};

		expect(localizeSetDuration(set)).toBe(m.generate_duration_approximate({ duration: '15m' }));
		expect(localizeDurationCoverage(set)).toBe(
			m.generate_duration_estimated_detail({ known: 3, unknown: 1 })
		);
		expect(localizeSetSummary(set)).toContain(m.generate_duration_approximate({ duration: '15m' }));
	});

	it('does not label fully known durations as estimates', () => {
		expect(localizeSetDuration({ estimatedDurationSeconds: 3600, unknownDurationCount: 0 })).toBe(
			'1h'
		);
	});
});
