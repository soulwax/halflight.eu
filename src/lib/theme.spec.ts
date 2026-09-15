import { describe, expect, it } from 'vitest';
import { getThemeLabel, isTheme, THEME_META, THEMES } from './theme';

describe('theme identity', () => {
	it('recognises every declared theme and rejects everything else', () => {
		for (const theme of THEMES) {
			expect(isTheme(theme)).toBe(true);
		}
		expect(isTheme('midnight')).toBe(false);
		expect(isTheme('')).toBe(false);
	});

	it('declares matching metadata for every theme, each with a real colour scheme', () => {
		for (const theme of THEMES) {
			expect(THEME_META[theme].id).toBe(theme);
			expect(['dark', 'light']).toContain(THEME_META[theme].colorScheme);
		}
		expect(THEME_META.light.colorScheme).toBe('light');
		expect(THEME_META.dark.colorScheme).toBe('dark');
	});

	it('resolves a non-empty, distinct name and description for every theme in the active locale', () => {
		const labels = THEMES.map((theme) => getThemeLabel(theme));

		for (const label of labels) {
			expect(label.name.length).toBeGreaterThan(0);
			expect(label.description.length).toBeGreaterThan(0);
		}
		// Every theme reads as its own thing, not a copy-pasted label.
		expect(new Set(labels.map((label) => label.name)).size).toBe(THEMES.length);
	});
});
