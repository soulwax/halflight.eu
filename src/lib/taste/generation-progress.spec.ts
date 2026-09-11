import { describe, expect, it } from 'vitest';
import { isGenerationStreamEvent } from './generation-progress';

describe('generation stream event guard', () => {
	it('accepts a bounded progress event', () => {
		expect(
			isGenerationStreamEvent({
				type: 'progress',
				sequence: 2,
				elapsedMs: 120,
				stage: 'expanding',
				requestsSpent: 3,
				candidateCount: 12
			})
		).toBe(true);
	});

	it('rejects malformed or unsafe payloads', () => {
		expect(isGenerationStreamEvent({ type: 'progress', sequence: -1, elapsedMs: 0 })).toBe(false);
		expect(
			isGenerationStreamEvent({ type: 'error', sequence: 1, elapsedMs: Number.NaN, errorCode: 'x' })
		).toBe(false);
	});
});
