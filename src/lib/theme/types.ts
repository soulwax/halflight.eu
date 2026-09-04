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

export const VISUAL_STYLES = [
	'art-deco',
	'art-nouveau',
	'bauhaus',
	'arts-and-crafts',
	'impressionism',
	'cubism',
	'surrealism',
	'expressionism',
	'pop-art',
	'abstract-expressionism'
] as const;

export type VisualStyle = (typeof VISUAL_STYLES)[number];

export const DEFAULT_VISUAL_STYLE: VisualStyle = 'art-deco';

export function isDarkTheme(value: unknown): value is DarkTheme {
	return typeof value === 'string' && (DARK_THEMES as readonly string[]).includes(value);
}

export function isVisualStyle(value: unknown): value is VisualStyle {
	return typeof value === 'string' && (VISUAL_STYLES as readonly string[]).includes(value);
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

export interface VisualStyleOption {
	id: VisualStyle;
	name: string;
	description: string;
}
