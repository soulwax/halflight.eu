import { describe, expect, it } from 'vitest';
import {
	DARK_THEMES,
	DEFAULT_THEME,
	DEFAULT_VISUAL_STYLE,
	isDarkTheme,
	isVisualStyle,
	parseUserSettings,
	getUserSettings,
	setUserTheme,
	setUserVisualStyle,
	type UserSettings,
	type UserSettingsStore
} from './user-settings';

function createMockStore(initial: Record<string, UserSettings> = {}): UserSettingsStore {
	const data = new Map(Object.entries(initial));
	return {
		async read(userId: string) {
			return data.get(userId) ?? null;
		},
		async write(userId: string, settings: UserSettings) {
			data.set(userId, settings);
			return settings;
		}
	};
}

describe('user-settings', () => {
	it('validates well-known dark themes', () => {
		for (const theme of DARK_THEMES) {
			expect(isDarkTheme(theme)).toBe(true);
		}
		expect(isDarkTheme('light')).toBe(false);
		expect(isDarkTheme('catppuccin-latte')).toBe(false);
		expect(isDarkTheme('')).toBe(false);
		expect(isDarkTheme(null)).toBe(false);
		expect(isDarkTheme(undefined)).toBe(false);
	});

	it('validates the supported visual styles', () => {
		expect(isVisualStyle('art-deco')).toBe(true);
		expect(isVisualStyle('abstract-expressionism')).toBe(true);
		expect(isVisualStyle('minimalism')).toBe(false);
		expect(isVisualStyle(null)).toBe(false);
	});

	it('falls back to default theme for unknown themes', () => {
		expect(parseUserSettings({ theme: 'nonexistent' })).toEqual({
			theme: DEFAULT_THEME,
			visualStyle: DEFAULT_VISUAL_STYLE
		});
		expect(parseUserSettings({ theme: 'nord', visualStyle: 'cubism' })).toEqual({
			theme: 'nord',
			visualStyle: 'cubism'
		});
	});

	it('reads default settings when none exist in store', async () => {
		const store = createMockStore();
		const settings = await getUserSettings('user-1', store);
		expect(settings).toEqual({ theme: 'tokyo-night', visualStyle: 'bauhaus' });
	});

	it('persists and reads user theme', async () => {
		const store = createMockStore();
		await setUserTheme('user-1', 'tokyo-night', store);
		const settings = await getUserSettings('user-1', store);
		expect(settings).toEqual({ theme: 'tokyo-night', visualStyle: DEFAULT_VISUAL_STYLE });
	});

	it('updates existing user theme', async () => {
		const store = createMockStore({
			'user-1': { theme: 'dracula', visualStyle: 'art-nouveau' }
		});
		await setUserTheme('user-1', 'gruvbox-dark', store);
		const settings = await getUserSettings('user-1', store);
		expect(settings).toEqual({ theme: 'gruvbox-dark', visualStyle: 'art-nouveau' });
	});

	it('updates visual style without replacing the colour theme', async () => {
		const store = createMockStore({
			'user-1': { theme: 'nord', visualStyle: 'art-deco' }
		});
		await setUserVisualStyle('user-1', 'pop-art', store);
		const settings = await getUserSettings('user-1', store);
		expect(settings).toEqual({ theme: 'nord', visualStyle: 'pop-art' });
	});
});
