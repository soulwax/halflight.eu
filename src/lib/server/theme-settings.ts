import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userAppearance } from '#lib/server/db/schema';
import { log } from '#lib/server/log';
import { DEFAULT_THEME, isTheme, type Theme } from '#lib/theme.js';

// The theme identity itself (id, metadata, "how to add one") lives in the
// client-safe `#lib/theme.ts` — a picker component needs it too, and none of
// it touches the database. Re-exported here so existing server-side imports
// (`hooks.server.ts`, the settings `+page.server.ts` files) keep one import
// path for "everything about themes, including persistence".
export {
	DEFAULT_THEME,
	isTheme,
	THEME_META,
	THEMES,
	type Theme,
	type ThemeMeta
} from '#lib/theme.js';

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
