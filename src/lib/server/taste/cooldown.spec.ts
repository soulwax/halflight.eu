import { describe, expect, it } from 'vitest';
import {
	GENERATION_COOLDOWN_DAYS,
	MAX_GENERATION_ACCEPTED_TRACKS,
	getGenerationCooldownTrackIds,
	normaliseGenerationCooldownTrackIds,
	recordGenerationCooldown,
	type GenerationCooldownStore
} from './cooldown';

const now = new Date('2026-09-05T00:00:00.000Z');

describe('generation cooldown', () => {
	it('keeps unique, bounded track IDs without display metadata', () => {
		const result = normaliseGenerationCooldownTrackIds([
			'track-1',
			'track-1',
			'',
			42,
			...Array.from({ length: MAX_GENERATION_ACCEPTED_TRACKS }, (_, index) => `track-${index + 2}`)
		]);

		expect(result).toHaveLength(MAX_GENERATION_ACCEPTED_TRACKS);
		expect(result.slice(0, 2)).toEqual(['track-1', 'track-2']);
	});

	it('records an accepted set with a fixed thirty-day expiry', async () => {
		const writes: Array<{ userId: string; trackIds: string[]; expiresAt: Date; writtenAt: Date }> =
			[];
		const store: GenerationCooldownStore = {
			read: async () => [],
			write: async (userId, trackIds, expiresAt, writtenAt) => {
				writes.push({ userId, trackIds, expiresAt, writtenAt });
			}
		};

		await recordGenerationCooldown('owner-1', ['track-1', 'track-2', 'track-1'], store, now);

		expect(writes).toEqual([
			{
				userId: 'owner-1',
				trackIds: ['track-1', 'track-2'],
				expiresAt: new Date(Date.UTC(2026, 8, 5 + GENERATION_COOLDOWN_DAYS, 0, 0, 0)),
				writtenAt: now
			}
		]);
	});

	it('fails open when the cooldown store is unavailable', async () => {
		const store: GenerationCooldownStore = {
			read: async () => {
				throw new Error('database unavailable');
			},
			write: async () => {}
		};

		const trackIds = await getGenerationCooldownTrackIds('owner-1', store, now);

		expect(trackIds).toEqual(new Set());
	});
});
