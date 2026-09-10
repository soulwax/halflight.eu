import * as v from 'valibot';

const targetCountSchema = v.pipe(
	v.string(),
	v.trim(),
	v.transform(Number),
	v.number(),
	v.safeInteger(),
	v.minValue(5),
	v.maxValue(100)
);

const familiaritySchema = v.pipe(
	v.string(),
	v.trim(),
	v.transform(Number),
	v.number(),
	v.safeInteger(),
	v.minValue(0),
	v.maxValue(100)
);

const seedArtistIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128));

const eraCenterSchema = v.pipe(
	v.string(),
	v.trim(),
	v.transform(Number),
	v.number(),
	v.safeInteger(),
	v.minValue(1900),
	v.maxValue(2100)
);

const minDurationSchema = v.pipe(
	v.string(),
	v.trim(),
	v.transform(Number),
	v.number(),
	v.safeInteger(),
	v.minValue(1),
	v.maxValue(600)
);

const generateTasteSetInputSchema = v.object({
	targetCount: targetCountSchema,
	familiarity: familiaritySchema,
	seedArtistId: v.optional(seedArtistIdSchema),
	eraCenter: v.optional(eraCenterSchema),
	minDurationSeconds: v.optional(minDurationSchema),
	excludeExplicit: v.boolean()
});

export type GenerateTasteSetInput = v.InferOutput<typeof generateTasteSetInputSchema>;

export type GenerateTasteSetInputResult =
	{ success: true; output: GenerateTasteSetInput } | { success: false };

/**
 * Converts an HTML form into bounded generation knobs. Invalid values are
 * rejected rather than silently clamped, so a forged request cannot change
 * the request budget or intended generation mode.
 */
export function parseGenerateTasteSetInput(
	formData: Pick<FormData, 'get'>
): GenerateTasteSetInputResult {
	const seedArtistId = formData.get('seedArtistId');
	const eraCenter = formData.get('eraCenter');
	const minDurationSeconds = formData.get('minDurationSeconds');
	const result = v.safeParse(generateTasteSetInputSchema, {
		targetCount: formData.get('targetCount') ?? '20',
		familiarity: formData.get('familiarity') ?? '50',
		seedArtistId: seedArtistId === null || seedArtistId === '' ? undefined : seedArtistId,
		eraCenter: eraCenter === null || eraCenter === '' ? undefined : eraCenter,
		minDurationSeconds:
			minDurationSeconds === null || minDurationSeconds === '' ? undefined : minDurationSeconds,
		// A checkbox is present only when ticked.
		excludeExplicit: formData.get('excludeExplicit') !== null
	});

	return result.success ? { success: true, output: result.output } : { success: false };
}
