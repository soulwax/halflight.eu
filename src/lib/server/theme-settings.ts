import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userAppearance } from '#lib/server/db/schema';
import { log } from '#lib/server/log';

/**
 * Every theme's actual colour values live once, in `src/routes/layout.css`'s
 * `[data-theme="…"]` blocks — this list only names them and carries display
 * metadata for the settings picker. Keeping colours in CSS alone means a
 * palette can never drift between what is defined and what is rendered.
 */
export const THEMES = ['dark', 'light', 'warm-night', 'electric'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';

export interface ThemeMeta {
	id: Theme;
	nameKey: 'theme_dark_name' | 'theme_light_name' | 'theme_warm_night_name' | 'theme_electric_name';
	descriptionKey:
		| 'theme_dark_description'
		| 'theme_light_description'
		| 'theme_warm_night_description'
		| 'theme_electric_description';
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
	electric: {
		id: 'electric',
		nameKey: 'theme_electric_name',
		descriptionKey: 'theme_electric_description',
		colorScheme: 'dark'
	}
};

export interface ThemeSettings {
	theme: Theme;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
	theme: DEFAULT_THEME
};

export interface ThemeSettingsStore {
	read(userId: string): Promise<ThemeSettings | null>;
	write(userId: string, settings: ThemeSettings): Promise<ThemeSettings>;
}

export const dbThemeSettingsStore: ThemeSettingsStore = {
	async read(userId) {
		const rows = await db
			.select({ theme: userAppearance.theme })
			.from(userAppearance)
			.where(eq(userAppearance.userId, userId))
			.limit(1);
		return rows[0] ? parseThemeSettings(rows[0]) : null;
	},
	async write(userId, settings) {
		const rows = await db
			.insert(userAppearance)
			.values({ userId, theme: settings.theme, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: userAppearance.userId,
				set: { theme: settings.theme, updatedAt: new Date() }
			})
			.returning({ theme: userAppearance.theme });
		return parseThemeSettings(rows[0]);
	}
};

export function isTheme(value: string): value is Theme {
	return (THEMES as readonly string[]).includes(value);
}

export function parseThemeSettings(value: { theme: string }): ThemeSettings {
	return {
		theme: isTheme(value.theme) ? value.theme : DEFAULT_THEME_SETTINGS.theme
	};
}

export function parseThemeSettingsInput(input: { theme?: string | null }): ThemeSettings | null {
	if (!input.theme || !isTheme(input.theme)) return null;
	return { theme: input.theme };
}

/**
 * Short-lived memo, same shape as `streaming-settings.ts`: theme is read on
 * every shell render (it must be known before first paint to avoid a flash of
 * the wrong palette), but changes only when the owner edits it in Settings.
 */
const MEMO_TTL_MS = 30_000;
const memo = new Map<string, { settings: ThemeSettings; expiresAt: number }>();

/** Test seam: drop the memoised settings. */
export function __resetThemeSettingsMemo(): void {
	memo.clear();
}

export async function getThemeSettings(
	userId: string,
	store: ThemeSettingsStore = dbThemeSettingsStore
): Promise<ThemeSettings> {
	const cached = memo.get(userId);
	if (cached && Date.now() < cached.expiresAt) return cached.settings;

	// A storage failure falls back to the default theme rather than 500-ing the page.
	try {
		const settings = (await store.read(userId)) ?? DEFAULT_THEME_SETTINGS;
		memo.set(userId, { settings, expiresAt: Date.now() + MEMO_TTL_MS });
		return settings;
	} catch (err) {
		log.error('theme-settings read failed, using default', { cause: err });
		return DEFAULT_THEME_SETTINGS;
	}
}

export async function saveThemeSettings(
	userId: string,
	settings: ThemeSettings,
	store: ThemeSettingsStore = dbThemeSettingsStore
): Promise<ThemeSettings> {
	memo.delete(userId);
	const written = await store.write(userId, settings);
	memo.set(userId, { settings: written, expiresAt: Date.now() + MEMO_TTL_MS });
	return written;
}
