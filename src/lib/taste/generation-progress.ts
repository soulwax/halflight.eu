import type { ProvisionalSet } from './provisional.js';

export type GenerationStreamStage = 'expanding' | 'scoring' | 'sequencing';

export type GenerationStreamEvent =
	| {
			type: 'progress';
			sequence: number;
			stage: GenerationStreamStage;
			elapsedMs: number;
			requestsSpent?: number;
			candidateCount?: number;
	  }
	| { type: 'complete'; sequence: number; elapsedMs: number; set: ProvisionalSet }
	| { type: 'error'; sequence: number; elapsedMs: number; errorCode: 'generation_unavailable' };

export function isGenerationStreamEvent(value: unknown): value is GenerationStreamEvent {
	if (!value || typeof value !== 'object') return false;
	const event = value as Record<string, unknown>;
	if (
		typeof event.sequence !== 'number' ||
		!Number.isSafeInteger(event.sequence) ||
		event.sequence < 0 ||
		typeof event.elapsedMs !== 'number' ||
		!Number.isFinite(event.elapsedMs) ||
		event.elapsedMs < 0
	) {
		return false;
	}
	if (event.type === 'progress') {
		return event.stage === 'expanding' || event.stage === 'scoring' || event.stage === 'sequencing';
	}
	if (event.type === 'complete') return Boolean(event.set && typeof event.set === 'object');
	return event.type === 'error' && event.errorCode === 'generation_unavailable';
}
