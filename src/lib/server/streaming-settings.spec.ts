import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	__resetStreamingSettingsMemo,
	DEFAULT_STREAMING_SETTINGS,
	getStreamingSettings,
	parseStreamingSettingsInput,
	saveStreamingSettings,
	type StreamingSettingsStore
} from './streaming-settings';

// The read is memoised per user, so each case starts from a cold memo.
beforeEach(() => {
	__resetStreamingSettingsMemo();
});

describe('streaming settings', () => {
	it('uses durable defaults until a user has saved preferences', async () => {
		const store: StreamingSettingsStore = {
			read: async () => null,
			write: async () => DEFAULT_STREAMING_SETTINGS
		};

		await expect(getStreamingSettings('user-1', store)).resolves.toEqual(
			DEFAULT_STREAMING_SETTINGS
		);
	});

	it('reads the store once per user within the memo window', async () => {
		// `/api/tracks/[id]/audio` resolves the preferred quality on every Range
		// request, so an unmemoised read here is a Postgres round-trip per seek.
		const read = vi.fn().mockResolvedValue(DEFAULT_STREAMING_SETTINGS);
		const store: StreamingSettingsStore = { read, write: async () => DEFAULT_STREAMING_SETTINGS };

		await getStreamingSettings('user-1', store);
		await getStreamingSettings('user-1', store);
		expect(read).toHaveBeenCalledTimes(1);

		await getStreamingSettings('user-2', store);
		expect(read).toHaveBeenCalledTimes(2);
	});

	it('serves a saved change immediately rather than waiting out the memo', async () => {
		const saved = { ...DEFAULT_STREAMING_SETTINGS, preferredQuality: 'LOSSLESS' as const };
		const store: StreamingSettingsStore = {
			read: async () => DEFAULT_STREAMING_SETTINGS,
			write: async () => saved
		};

		await getStreamingSettings('user-1', store);
		await saveStreamingSettings('user-1', saved, store);

		await expect(getStreamingSettings('user-1', store)).resolves.toEqual(saved);
	});

	it('does not memoise defaults produced by a storage failure', async () => {
		const read = vi
			.fn()
			.mockRejectedValueOnce(new Error('db down'))
			.mockResolvedValue({ ...DEFAULT_STREAMING_SETTINGS, preferredQuality: 'LOSSLESS' as const });
		const store: StreamingSettingsStore = { read, write: async () => DEFAULT_STREAMING_SETTINGS };

		await expect(getStreamingSettings('user-1', store)).resolves.toEqual(
			DEFAULT_STREAMING_SETTINGS
		);
		// A transient outage must not pin defaults for the whole TTL.
		await expect(getStreamingSettings('user-1', store)).resolves.toMatchObject({
			preferredQuality: 'LOSSLESS'
		});
	});

	it('accepts only supported qualities and a whole-number volume', () => {
		expect(
			parseStreamingSettingsInput({
				preferredQuality: 'LOSSLESS',
				volume: '72',
				loudnessNormalization: 'on'
			})
		).toEqual({ preferredQuality: 'LOSSLESS', volume: 72, loudnessNormalization: true });
		expect(
			parseStreamingSettingsInput({ preferredQuality: 'HI_RES_LOSSLESS', volume: '72' })
		).toEqual({ preferredQuality: 'HI_RES_LOSSLESS', volume: 72, loudnessNormalization: false });
		expect(parseStreamingSettingsInput({ preferredQuality: 'HIRES', volume: '72' })).toBe(null);
		expect(parseStreamingSettingsInput({ preferredQuality: 'HIGH', volume: '100.5' })).toBe(null);
	});
});
