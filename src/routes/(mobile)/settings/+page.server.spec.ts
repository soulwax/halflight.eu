import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('#lib/server/storage', () => ({ getStorageOverview: vi.fn() }));

const mocks = vi.hoisted(() => ({
	saveStreamingSettings: vi.fn(),
	saveThemeSettings: vi.fn()
}));

vi.mock('#lib/server/streaming-settings', () => ({
	parseStreamingSettingsInput: (input: { preferredQuality?: string; volume?: string }) =>
		input.preferredQuality === 'LOSSLESS' && input.volume === '65'
			? { preferredQuality: 'LOSSLESS', volume: 65, loudnessNormalization: true }
			: null,
	saveStreamingSettings: mocks.saveStreamingSettings
}));

vi.mock('#lib/server/theme-settings', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/server/theme-settings')>();
	return {
		...actual,
		saveThemeSettings: mocks.saveThemeSettings
	};
});

import { actions } from './+page.server';

function event(request: Request) {
	return { locals: { user: { id: 'owner' } }, request } as never;
}

describe('/settings streaming action', () => {
	beforeEach(() => mocks.saveStreamingSettings.mockReset());

	it('persists a valid mobile streaming preference', async () => {
		mocks.saveStreamingSettings.mockResolvedValue({});
		const result = await actions.saveStreamingSettings(
			event(
				new Request('http://localhost/settings?/saveStreamingSettings', {
					method: 'POST',
					body: new URLSearchParams({
						preferredQuality: 'LOSSLESS',
						volume: '65',
						loudnessNormalization: 'on'
					})
				})
			)
		);

		expect(mocks.saveStreamingSettings).toHaveBeenCalledWith('owner', {
			preferredQuality: 'LOSSLESS',
			volume: 65,
			loudnessNormalization: true
		});
		expect(result).toEqual({ streamingSettingsSaved: true });
	});

	it('rejects an invalid mobile streaming preference', async () => {
		const result = await actions.saveStreamingSettings(
			event(
				new Request('http://localhost/settings?/saveStreamingSettings', {
					method: 'POST',
					body: new URLSearchParams({ preferredQuality: 'INVALID', volume: '65' })
				})
			)
		);

		expect(mocks.saveStreamingSettings).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 400, data: { streamingSettingsError: true } });
	});
});

describe('/settings theme action', () => {
	beforeEach(() => mocks.saveThemeSettings.mockReset());

	it('persists a valid mobile theme choice', async () => {
		mocks.saveThemeSettings.mockResolvedValue({ theme: 'warm-night' });
		const result = await actions.saveTheme(
			event(
				new Request('http://localhost/settings?/saveTheme', {
					method: 'POST',
					body: new URLSearchParams({ theme: 'warm-night' })
				})
			)
		);

		expect(mocks.saveThemeSettings).toHaveBeenCalledWith('owner', { theme: 'warm-night' });
		expect(result).toEqual({ themeSaved: true, theme: 'warm-night' });
	});

	it('rejects an unknown theme id', async () => {
		const result = await actions.saveTheme(
			event(
				new Request('http://localhost/settings?/saveTheme', {
					method: 'POST',
					body: new URLSearchParams({ theme: 'not-a-theme' })
				})
			)
		);

		expect(mocks.saveThemeSettings).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 400, data: { themeError: true } });
	});
});
