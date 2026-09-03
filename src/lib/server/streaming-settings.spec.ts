import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STREAMING_SETTINGS,
	getStreamingSettings,
	parseStreamingSettingsInput,
	type StreamingSettingsStore
} from './streaming-settings';

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

	it('accepts only supported qualities and a whole-number volume', () => {
		expect(
			parseStreamingSettingsInput({
				preferredQuality: 'LOSSLESS',
				volume: '72',
				loudnessNormalization: 'on'
			})
		).toEqual({ preferredQuality: 'LOSSLESS', volume: 72, loudnessNormalization: true });
		expect(parseStreamingSettingsInput({ preferredQuality: 'HI_RES_LOSSLESS', volume: '72' })).toBe(
			null
		);
		expect(parseStreamingSettingsInput({ preferredQuality: 'HIGH', volume: '100.5' })).toBe(null);
	});
});
