import { DEFAULT_THEME, isDarkTheme, type DarkTheme, type ThemeOption } from './types.js';

export {
	DARK_THEMES,
	DEFAULT_THEME,
	isDarkTheme,
	type DarkTheme,
	type ThemeOption
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

class ThemeManager {
	current = $state<DarkTheme>(DEFAULT_THEME);

	init(serverTheme?: string | null) {
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

		this.apply(selected, false);
	}

	setTheme(theme: DarkTheme) {
		if (!isDarkTheme(theme)) return;
		this.apply(theme, true);
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
}

export const themeManager = new ThemeManager();
