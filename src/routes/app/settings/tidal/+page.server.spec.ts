import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		getStreamingSettings: vi.fn(),
		saveStreamingSettings: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus
}));

vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: mocks.getStreamingSettings,
	parseStreamingSettingsInput: (input: { preferredQuality?: string; volume?: string }) =>
		input.preferredQuality === 'LOSSLESS' && input.volume === '65'
			? { preferredQuality: 'LOSSLESS', volume: 65, loudnessNormalization: true }
			: null,
	saveStreamingSettings: mocks.saveStreamingSettings
}));

import { actions, load } from './+page.server';

function event(search = '') {
	return {
		url: new URL(`http://localhost/app/settings/tidal${search}`),
		locals: { user: { id: 'user-1' }, isAdministrator: true }
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/settings/tidal load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getStreamingSettings.mockReset();
		mocks.saveStreamingSettings.mockReset();
	});

	it('returns connection status and persisted streaming settings without token material', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getStreamingSettings.mockResolvedValue({
			preferredQuality: 'LOSSLESS',
			volume: 65,
			loudnessNormalization: true
		});

		const result = await load(event());
		expect(result).toMatchObject({
			status: { connected: true, configured: true },
			streamingSettings: { preferredQuality: 'LOSSLESS', volume: 65, loudnessNormalization: true }
		});
	});

	it('loads settings even when TIDAL is disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });
		mocks.getStreamingSettings.mockResolvedValue({
			preferredQuality: 'HIGH',
			volume: 100,
			loudnessNormalization: true
		});

		const result = await load(event());
		expect(result).toMatchObject({
			status: { connected: false, configured: true },
			streamingSettings: { preferredQuality: 'HIGH' }
		});
	});

	it('persists valid streaming settings', async () => {
		mocks.saveStreamingSettings.mockResolvedValue({
			preferredQuality: 'LOSSLESS',
			volume: 65,
			loudnessNormalization: true
		});
		const request = new Request('http://localhost/app/settings/tidal?/saveStreamingSettings', {
			method: 'POST',
			body: new URLSearchParams({
				preferredQuality: 'LOSSLESS',
				volume: '65',
				loudnessNormalization: 'on'
			})
		});
		const result = await actions.saveStreamingSettings({ ...event(), request } as never);

		expect(mocks.saveStreamingSettings).toHaveBeenCalledWith('user-1', {
			preferredQuality: 'LOSSLESS',
			volume: 65,
			loudnessNormalization: true
		});
		expect(result).toEqual({ streamingSettingsSaved: true });
	});
});
