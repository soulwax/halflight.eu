import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userSettings } from '#lib/server/db/schema';
import { DARK_THEMES, DEFAULT_THEME, isDarkTheme, type DarkTheme } from '#lib/theme/types';

export { DARK_THEMES, DEFAULT_THEME, isDarkTheme, type DarkTheme };

export interface UserSettings {
	theme: DarkTheme;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
	theme: DEFAULT_THEME
};

export interface UserSettingsStore {
	read(userId: string): Promise<UserSettings | null>;
	write(userId: string, settings: UserSettings): Promise<UserSettings>;
}

export const dbUserSettingsStore: UserSettingsStore = {
	async read(userId) {
		const rows = await db
			.select({
				theme: userSettings.theme
			})
			.from(userSettings)
			.where(eq(userSettings.userId, userId))
			.limit(1);
		return rows[0] ? parseUserSettings(rows[0]) : null;
	},
	async write(userId, settings) {
		const rows = await db
			.insert(userSettings)
			.values({ userId, ...settings, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: userSettings.userId,
				set: { ...settings, updatedAt: new Date() }
			})
			.returning({
				theme: userSettings.theme
			});
		return parseUserSettings(rows[0]);
	}
};

export function parseUserSettings(value: { theme: string }): UserSettings {
	return {
		theme: isDarkTheme(value.theme) ? value.theme : DEFAULT_THEME
	};
}

export async function getUserSettings(
	userId: string,
	store: UserSettingsStore = dbUserSettingsStore
): Promise<UserSettings> {
	// The app shell loads this on every page — a storage hiccup (or a pending
	// migration) must fall back to defaults, never 500 the whole app.
	try {
		return (await store.read(userId)) ?? DEFAULT_USER_SETTINGS;
	} catch (err) {
		console.error(`[user-settings] read failed, using defaults: ${err}`);
		return DEFAULT_USER_SETTINGS;
	}
}

export async function setUserTheme(
	userId: string,
	theme: DarkTheme,
	store: UserSettingsStore = dbUserSettingsStore
): Promise<UserSettings> {
	return store.write(userId, { theme });
}
