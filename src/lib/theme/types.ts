export const DARK_THEMES = [
	'bauhaus-dark',
	'catppuccin-mocha',
	'tokyo-night',
	'dracula',
	'gruvbox-dark',
	'nord',
	'rose-pine-moon',
	'oled-black'
] as const;

export type DarkTheme = (typeof DARK_THEMES)[number];

export const DEFAULT_THEME: DarkTheme = 'bauhaus-dark';

export function isDarkTheme(value: unknown): value is DarkTheme {
	return typeof value === 'string' && (DARK_THEMES as readonly string[]).includes(value);
}

export interface ThemeOption {
	id: DarkTheme;
	name: string;
	description: string;
	swatch: {
		bg: string;
		surface: string;
		accent: string;
		text: string;
	};
}
