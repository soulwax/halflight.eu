import { describe, expect, it, vi } from 'vitest';
import { getRequestedStreamQuality } from './playback';

describe('getRequestedStreamQuality', () => {
	it('uses a supported explicit override before the persisted preference', async () => {
		const readSettings = vi.fn();
		await expect(
			getRequestedStreamQuality(
				new URL('https://syn.test/api/tracks/1/audio?quality=lossless'),
				'owner-1',
				readSettings
			)
		).resolves.toBe('LOSSLESS');
		expect(readSettings).not.toHaveBeenCalled();
	});

	it('uses the durable preference when no valid override exists', async () => {
		const readSettings = vi.fn().mockResolvedValue({ preferredQuality: 'HIGH' });
		await expect(
			getRequestedStreamQuality(
				new URL('https://syn.test/api/tracks/1/audio?quality=unsupported'),
				'owner-1',
				readSettings
			)
		).resolves.toBe('HIGH');
		expect(readSettings).toHaveBeenCalledWith('owner-1');
	});
});
