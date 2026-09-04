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
	it('parses bounded integer knobs and an optional trimmed artist seed', () => {
		const result = parseGenerateTasteSetInput(
			formData({ targetCount: ' 25 ', familiarity: '70', seedArtistId: ' artist-1 ' })
		);

		expect(result).toEqual({
			success: true,
			output: { targetCount: 25, familiarity: 70, seedArtistId: 'artist-1' }
		});
	});

	it('uses safe defaults when fields are absent', () => {
		const result = parseGenerateTasteSetInput(formData({}));

		expect(result).toEqual({
			success: true,
			output: { targetCount: 20, familiarity: 50, seedArtistId: undefined }
		});
	});

	it('rejects forged values instead of coercing them into the allowed range', () => {
		const result = parseGenerateTasteSetInput(
			formData({ targetCount: '1000', familiarity: '12.5', seedArtistId: '' })
		);

		expect(result).toEqual({ success: false });
	});
});
