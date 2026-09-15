import { m } from '#lib/paraglide/messages.js';

/**
 * Client-safe theme identity: which themes exist, and how to label one.
 *
 * Every theme's actual styling — colour, corner radius, shadow, type, motion
 * — lives once, in `src/routes/layout.css`'s `[data-theme="…"]` blocks. This
 * module only names the theme and resolves its display label; the DB-backed
 * accessor (`#lib/server/theme-settings.ts`, which re-exports `THEMES`,
 * `Theme`, `DEFAULT_THEME`, `ThemeMeta`, `THEME_META`, and `isTheme` from
 * here) adds persistence on top. Keeping style in CSS alone means it can
 * never drift between what is defined and what is rendered, and it's what
 * lets a picker swatch show a theme's *real* look by nesting its own
 * `data-theme` attribute rather than duplicating colour into TypeScript.
 *
 * ## Adding a theme
 *
 * Four places, each small and each enforced by the compiler or a test:
 *
 * 1. Add the id to `THEMES` below.
 * 2. Add its entry to `THEME_META` and `THEME_LABEL_MESSAGES` — TypeScript
 *    refuses to compile until both exist and name real message functions,
 *    so step 3 can't be skipped by accident.
 * 3. Add `theme_<id>_name` / `theme_<id>_description` to `messages/en.json`
 *    and `messages/de-de.json` (`i18n-coverage.spec.ts` fails the build on a
 *    missing translation, in either direction).
 * 4. Add a `[data-theme='<id>']` block to `src/routes/layout.css`, in the
 *    "Themes" section at the top of the file — see that section's own
 *    comment for exactly which tokens a block needs to set, and which it
 *    can leave to their shared default.
 *
 * No DB migration: `user_appearance.theme` has no CHECK constraint on
 * purpose (see its comment in `schema.ts`) — `parseThemeSettingsInput`,
 * gated by `isTheme` against the array below, is the one place that decides
 * what's valid, and a new theme is valid the moment it's added here.
 *
 * The settings pages (desktop and mobile) call `getThemeLabel` and never
 * duplicate this mapping between them — that duplication is exactly what
 * this module replaced.
 */
export const THEMES = ['dark', 'light', 'warm-night', 'blue-hour', 'electric'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';

export interface ThemeMeta {
	id: Theme;
	nameKey:
		| 'theme_dark_name'
		| 'theme_light_name'
		| 'theme_warm_night_name'
		| 'theme_blue_hour_name'
		| 'theme_electric_name';
	descriptionKey:
		| 'theme_dark_description'
		| 'theme_light_description'
		| 'theme_warm_night_description'
		| 'theme_blue_hour_description'
		| 'theme_electric_description';
	/** Sets `color-scheme` and decides contrast for UA-styled controls (scrollbars, form fields). */
	colorScheme: 'dark' | 'light';
}

export const THEME_META: Record<Theme, ThemeMeta> = {
	dark: {
		id: 'dark',
		nameKey: 'theme_dark_name',
		descriptionKey: 'theme_dark_description',
		colorScheme: 'dark'
	},
	light: {
		id: 'light',
		nameKey: 'theme_light_name',
		descriptionKey: 'theme_light_description',
		colorScheme: 'light'
	},
	'warm-night': {
		id: 'warm-night',
		nameKey: 'theme_warm_night_name',
		descriptionKey: 'theme_warm_night_description',
		colorScheme: 'dark'
	},
	'blue-hour': {
		id: 'blue-hour',
		nameKey: 'theme_blue_hour_name',
		descriptionKey: 'theme_blue_hour_description',
		colorScheme: 'dark'
	},
	electric: {
		id: 'electric',
		nameKey: 'theme_electric_name',
		descriptionKey: 'theme_electric_description',
		colorScheme: 'dark'
	}
};

export function isTheme(value: string): value is Theme {
	return (THEMES as readonly string[]).includes(value);
}

interface ThemeLabelMessages {
	name: () => string;
	description: () => string;
}

/** `THEME_META`'s message keys, resolved to the actual Paraglide functions once. */
const THEME_LABEL_MESSAGES: Record<Theme, ThemeLabelMessages> = {
	dark: { name: m.theme_dark_name, description: m.theme_dark_description },
	light: { name: m.theme_light_name, description: m.theme_light_description },
	'warm-night': { name: m.theme_warm_night_name, description: m.theme_warm_night_description },
	'blue-hour': { name: m.theme_blue_hour_name, description: m.theme_blue_hour_description },
	electric: { name: m.theme_electric_name, description: m.theme_electric_description }
};

export interface ThemeLabel {
	name: string;
	description: string;
}

/** Resolve a theme's display label in the active locale. */
export function getThemeLabel(theme: Theme): ThemeLabel {
	const messages = THEME_LABEL_MESSAGES[theme];
	return { name: messages.name(), description: messages.description() };
}
