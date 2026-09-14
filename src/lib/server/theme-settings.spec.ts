import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	__resetThemeSettingsMemo,
	DEFAULT_THEME_SETTINGS,
	getThemeSettings,
	isTheme,
	parseThemeSettingsInput,
	saveThemeSettings,
	THEME_META,
	THEMES,
	type ThemeSettingsStore
} from './theme-settings';

// The read is memoised per user, so each case starts from a cold memo.
beforeEach(() => {
	__resetThemeSettingsMemo();
});

describe('theme settings', () => {
	it('uses the default theme until a user has chosen one', async () => {
		const store: ThemeSettingsStore = {
			read: async () => null,
			write: async () => DEFAULT_THEME_SETTINGS
		};

		await expect(getThemeSettings('user-1', store)).resolves.toEqual(DEFAULT_THEME_SETTINGS);
	});

	it('reads the store once per user within the memo window', async () => {
		// The theme must be known before first paint on every request, so an
		// unmemoised read here is a Postgres round-trip per page load.
		const read = vi.fn().mockResolvedValue(DEFAULT_THEME_SETTINGS);
		const store: ThemeSettingsStore = { read, write: async () => DEFAULT_THEME_SETTINGS };

		await getThemeSettings('user-1', store);
		await getThemeSettings('user-1', store);
		expect(read).toHaveBeenCalledTimes(1);

		await getThemeSettings('user-2', store);
		expect(read).toHaveBeenCalledTimes(2);
	});

	it('serves a saved change immediately rather than waiting out the memo', async () => {
		const saved = { theme: 'light' as const };
		const store: ThemeSettingsStore = {
			read: async () => DEFAULT_THEME_SETTINGS,
			write: async () => saved
		};

		await getThemeSettings('user-1', store);
		await saveThemeSettings('user-1', saved, store);

		await expect(getThemeSettings('user-1', store)).resolves.toEqual(saved);
	});

	it('does not memoise the default produced by a storage failure', async () => {
		const read = vi
			.fn()
			.mockRejectedValueOnce(new Error('db down'))
			.mockResolvedValue({ theme: 'electric' as const });
		const store: ThemeSettingsStore = { read, write: async () => DEFAULT_THEME_SETTINGS };

		await expect(getThemeSettings('user-1', store)).resolves.toEqual(DEFAULT_THEME_SETTINGS);
		// A transient outage must not pin the default for the whole TTL.
		await expect(getThemeSettings('user-1', store)).resolves.toEqual({ theme: 'electric' });
	});

	it('recognises every declared theme and rejects everything else', () => {
		for (const theme of THEMES) {
			expect(isTheme(theme)).toBe(true);
		}
		expect(isTheme('midnight')).toBe(false);
		expect(isTheme('')).toBe(false);
	});

	it('accepts only a known theme id as input', () => {
		expect(parseThemeSettingsInput({ theme: 'light' })).toEqual({ theme: 'light' });
		expect(parseThemeSettingsInput({ theme: 'neon' })).toBe(null);
		expect(parseThemeSettingsInput({ theme: null })).toBe(null);
		expect(parseThemeSettingsInput({})).toBe(null);
	});

	it('declares matching metadata for every theme, each with the correct colour scheme', () => {
		for (const theme of THEMES) {
			expect(THEME_META[theme].id).toBe(theme);
			expect(['dark', 'light']).toContain(THEME_META[theme].colorScheme);
		}
		expect(THEME_META.light.colorScheme).toBe('light');
		expect(THEME_META.dark.colorScheme).toBe('dark');
	});
});
