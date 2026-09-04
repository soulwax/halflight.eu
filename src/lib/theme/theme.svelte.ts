import {
	DEFAULT_THEME,
	DEFAULT_VISUAL_STYLE,
	isDarkTheme,
	isVisualStyle,
	type DarkTheme,
	type ThemeOption,
	type VisualStyle,
	type VisualStyleOption
} from './types.js';

export {
	DARK_THEMES,
	DEFAULT_THEME,
	DEFAULT_VISUAL_STYLE,
	isDarkTheme,
	isVisualStyle,
	VISUAL_STYLES,
	type DarkTheme,
	type ThemeOption,
	type VisualStyle,
	type VisualStyleOption
} from './types.js';

export const THEME_OPTIONS: readonly ThemeOption[] = [
	{
		id: 'bauhaus-dark',
		name: 'Bauhaus Dark',
		description: 'Charcoal canvas with warm brass, jade, and oxblood accents',
		swatch: {
			bg: '#1c1c1b',
			surface: '#272725',
			accent: '#d4af37',
			text: '#f2f0eb'
		}
	},
	{
		id: 'catppuccin-mocha',
		name: 'Catppuccin Mocha',
		description: 'Soothing pastel dark palette with mauve, peach, and lavender',
		swatch: {
			bg: '#1e1e2e',
			surface: '#313244',
			accent: '#cba6f7',
			text: '#cdd6f4'
		}
	},
	{
		id: 'tokyo-night',
		name: 'Tokyo Night',
		description: 'Vibrant neon blues and cyans reflecting downtown Tokyo',
		swatch: {
			bg: '#1a1b26',
			surface: '#24283b',
			accent: '#7aa2f7',
			text: '#c0caf5'
		}
	},
	{
		id: 'dracula',
		name: 'Dracula',
		description: 'Famous gothic high-contrast dark theme with purple and pink',
		swatch: {
			bg: '#282a36',
			surface: '#44475a',
			accent: '#bd93f9',
			text: '#f8f8f2'
		}
	},
	{
		id: 'gruvbox-dark',
		name: 'Gruvbox Dark',
		description: 'Warm retro groove aesthetic with terracotta and golden yellow',
		swatch: {
			bg: '#282828',
			surface: '#3c3836',
			accent: '#fabd2f',
			text: '#ebdbb2'
		}
	},
	{
		id: 'nord',
		name: 'Nord',
		description: 'Arctic, north-bluish clean palette inspired by polar ice',
		swatch: {
			bg: '#2e3440',
			surface: '#3b4252',
			accent: '#88c0d0',
			text: '#eceff4'
		}
	},
	{
		id: 'rose-pine-moon',
		name: 'Rosé Pine Moon',
		description: 'All natural pine and floral dusk tones with warm gold',
		swatch: {
			bg: '#232136',
			surface: '#2a273f',
			accent: '#c4a7e7',
			text: '#e0def4'
		}
	},
	{
		id: 'oled-black',
		name: 'OLED Pitch Black',
		description: 'Pure #000000 true black with high-visibility amber accent',
		swatch: {
			bg: '#000000',
			surface: '#18181b',
			accent: '#fbbf24',
			text: '#fafafa'
		}
	}
] as const;

export const VISUAL_STYLE_OPTIONS: readonly VisualStyleOption[] = [
	{
		id: 'art-deco',
		name: 'Art Deco',
		description: 'Symmetry, brass details, and streamlined luxury'
	},
	{ id: 'art-nouveau', name: 'Art Nouveau', description: 'Flowing curves and botanical ornament' },
	{ id: 'bauhaus', name: 'Bauhaus', description: 'Functional geometry and primary forms' },
	{
		id: 'arts-and-crafts',
		name: 'Arts and Crafts',
		description: 'Warm materials and hand-made texture'
	},
	{ id: 'impressionism', name: 'Impressionism', description: 'Soft light and layered colour' },
	{ id: 'cubism', name: 'Cubism', description: 'Faceted planes and deliberate angles' },
	{ id: 'surrealism', name: 'Surrealism', description: 'Dreamlike depth and unexpected forms' },
	{
		id: 'expressionism',
		name: 'Expressionism',
		description: 'Emotive contrast and energetic marks'
	},
	{ id: 'pop-art', name: 'Pop Art', description: 'Graphic dots, bold outlines, and punch' },
	{
		id: 'abstract-expressionism',
		name: 'Abstract Expressionism',
		description: 'Gestural colour and expansive atmosphere'
	}
] as const;

class ThemeManager {
	current = $state<DarkTheme>(DEFAULT_THEME);
	currentStyle = $state<VisualStyle>(DEFAULT_VISUAL_STYLE);

	init(serverTheme?: string | null, serverStyle?: string | null) {
		if (typeof window === 'undefined') return;

		let selected: DarkTheme = DEFAULT_THEME;

		// 1. Check server-provided user setting (from database)
		if (serverTheme && isDarkTheme(serverTheme)) {
			selected = serverTheme;
		} else {
			// 2. Fall back to localStorage
			try {
				const local = localStorage.getItem('syn-theme');
				if (local && isDarkTheme(local)) {
					selected = local;
				} else {
					// 3. Fall back to cookie
					const match = document.cookie.match(/(?:^|;\s*)syn-theme=([^;]+)/);
					if (match && isDarkTheme(match[1])) {
						selected = match[1];
					}
				}
			} catch {
				// Local storage disabled / blocked
			}
		}

		let selectedStyle: VisualStyle = DEFAULT_VISUAL_STYLE;
		if (serverStyle && isVisualStyle(serverStyle)) {
			selectedStyle = serverStyle;
		} else {
			try {
				const local = localStorage.getItem('syn-visual-style');
				if (local && isVisualStyle(local)) {
					selectedStyle = local;
				} else {
					const match = document.cookie.match(/(?:^|;\s*)syn-visual-style=([^;]+)/);
					if (match && isVisualStyle(match[1])) selectedStyle = match[1];
				}
			} catch {
				// Local storage disabled / blocked
			}
		}

		this.apply(selected, false);
		this.applyStyle(selectedStyle, false);
	}

	setTheme(theme: DarkTheme) {
		if (!isDarkTheme(theme)) return;
		this.apply(theme, true);
	}

	setVisualStyle(style: VisualStyle) {
		if (!isVisualStyle(style)) return;
		this.applyStyle(style, true);
	}

	private apply(theme: DarkTheme, persist: boolean) {
		this.current = theme;

		if (typeof window === 'undefined') return;

		// Apply to DOM attribute immediately
		document.documentElement.dataset.theme = theme;

		if (!persist) return;

		// Persist to local storage
		try {
			localStorage.setItem('syn-theme', theme);
		} catch {
			// ignore storage quotas/restrictions
		}

		// Persist to cookie for SSR
		try {
			document.cookie = `syn-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
		} catch {
			// ignore cookie restrictions
		}

		// Persist to database in background
		fetch('/api/settings/theme', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ theme })
		}).catch(() => {
			// Best effort background sync; offline-resilient via localStorage
		});
	}

	private applyStyle(style: VisualStyle, persist: boolean) {
		this.currentStyle = style;

		if (typeof window === 'undefined') return;

		document.documentElement.dataset.style = style;

		if (!persist) return;

		try {
			localStorage.setItem('syn-visual-style', style);
		} catch {
			// ignore storage quotas/restrictions
		}

		try {
			document.cookie = `syn-visual-style=${style}; path=/; max-age=31536000; SameSite=Lax`;
		} catch {
			// ignore cookie restrictions
		}

		fetch('/api/settings/theme', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ visualStyle: style })
		}).catch(() => {
			// Best effort background sync; offline-resilient via localStorage
		});
	}
}

export const themeManager = new ThemeManager();
