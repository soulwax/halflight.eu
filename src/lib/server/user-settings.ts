import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userSettings } from '#lib/server/db/schema';
import { log } from '#lib/server/log';
import {
	DARK_THEMES,
	DEFAULT_THEME,
	DEFAULT_VISUAL_STYLE,
	isDarkTheme,
	isVisualStyle,
	type DarkTheme,
	type VisualStyle
} from '#lib/theme/types';

export {
	DARK_THEMES,
	DEFAULT_THEME,
	DEFAULT_VISUAL_STYLE,
	isDarkTheme,
	isVisualStyle,
	type DarkTheme,
	type VisualStyle
};

export interface UserSettings {
	theme: DarkTheme;
	visualStyle: VisualStyle;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
	theme: DEFAULT_THEME,
	visualStyle: DEFAULT_VISUAL_STYLE
};

export interface UserSettingsStore {
	read(userId: string): Promise<UserSettings | null>;
	write(userId: string, settings: UserSettings): Promise<UserSettings>;
}

export const dbUserSettingsStore: UserSettingsStore = {
	async read(userId) {
		const rows = await db
			.select({
				theme: userSettings.theme,
				visualStyle: userSettings.visualStyle
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
				theme: userSettings.theme,
				visualStyle: userSettings.visualStyle
			});
		return parseUserSettings(rows[0]);
	}
};

export function parseUserSettings(value: {
	theme: string;
	visualStyle?: string | null;
}): UserSettings {
	return {
		theme: isDarkTheme(value.theme) ? value.theme : DEFAULT_THEME,
		visualStyle: isVisualStyle(value.visualStyle) ? value.visualStyle : DEFAULT_VISUAL_STYLE
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
		log.error('user-settings read failed, using defaults', { cause: err });
		return DEFAULT_USER_SETTINGS;
	}
}

export async function setUserTheme(
	userId: string,
	theme: DarkTheme,
	store: UserSettingsStore = dbUserSettingsStore
): Promise<UserSettings> {
	const current = (await store.read(userId)) ?? DEFAULT_USER_SETTINGS;
	return store.write(userId, { ...current, theme });
}

export async function setUserVisualStyle(
	userId: string,
	visualStyle: VisualStyle,
	store: UserSettingsStore = dbUserSettingsStore
): Promise<UserSettings> {
	const current = (await store.read(userId)) ?? DEFAULT_USER_SETTINGS;
	return store.write(userId, { ...current, visualStyle });
}
