import { describe, expect, it } from 'vitest';
import { parseGenerateTasteSetInput } from './generate-input';

function formData(entries: Record<string, FormDataEntryValue>): Pick<FormData, 'get'> {
	return {
		get(name) {
			return entries[name] ?? null;
		}
	};
}

describe('generation input', () => {
	it('parses every knob — counts, seed, era, minimum length, and the explicit toggle', () => {
		const result = parseGenerateTasteSetInput(
			formData({
				targetCount: ' 25 ',
				familiarity: '70',
				seedArtistId: ' artist-1 ',
				eraCenter: '1995',
				minDurationSeconds: '90',
				excludeExplicit: 'on'
			})
		);

		expect(result).toEqual({
			success: true,
			output: {
				targetCount: 25,
				familiarity: 70,
				seedArtistId: 'artist-1',
				eraCenter: 1995,
				minDurationSeconds: 90,
				excludeExplicit: true
			}
		});
	});

	it('uses safe defaults when fields are absent', () => {
		const result = parseGenerateTasteSetInput(formData({}));

		expect(result).toEqual({
			success: true,
			output: {
				targetCount: 20,
				familiarity: 50,
				seedArtistId: undefined,
				eraCenter: undefined,
				minDurationSeconds: undefined,
				excludeExplicit: false
			}
		});
	});

	it('rejects a minimum length past the allowed ceiling', () => {
		const result = parseGenerateTasteSetInput(
			formData({ targetCount: '20', familiarity: '50', minDurationSeconds: '900' })
		);

		expect(result).toEqual({ success: false });
	});

	it('treats an empty era selection as unconstrained', () => {
		const result = parseGenerateTasteSetInput(
			formData({ targetCount: '20', familiarity: '50', eraCenter: '' })
		);

		expect(result).toMatchObject({ success: true, output: { eraCenter: undefined } });
	});

	it('rejects an out-of-range era centre year', () => {
		const result = parseGenerateTasteSetInput(
			formData({ targetCount: '20', familiarity: '50', eraCenter: '1200' })
		);

		expect(result).toEqual({ success: false });
	});

	it('rejects forged values instead of coercing them into the allowed range', () => {
		const result = parseGenerateTasteSetInput(
			formData({ targetCount: '1000', familiarity: '12.5', seedArtistId: '' })
		);

		expect(result).toEqual({ success: false });
	});
});
