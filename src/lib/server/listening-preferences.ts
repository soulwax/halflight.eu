import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { listeningPreferences } from '#lib/server/db/schema';
import { log } from '#lib/server/log';

export const AUTOPLAY_COUNTS = [5, 10, 20] as const;

export interface ListeningPreferences {
	autoplay: boolean;
	autoplayCount: number;
	personalizeSuggestions: boolean;
	learnFromListening: boolean;
	useLastfmHistory: boolean;
	learnFromPlaylists: boolean;
}

export const DEFAULT_LISTENING_PREFERENCES: ListeningPreferences = {
	autoplay: true,
	autoplayCount: 10,
	personalizeSuggestions: true,
	learnFromListening: true,
	useLastfmHistory: true,
	learnFromPlaylists: true
};

export interface ListeningPreferencesStore {
	read(userId: string): Promise<ListeningPreferences | null>;
	write(userId: string, preferences: ListeningPreferences): Promise<ListeningPreferences>;
}

const columns = {
	autoplay: listeningPreferences.autoplay,
	autoplayCount: listeningPreferences.autoplayCount,
	personalizeSuggestions: listeningPreferences.personalizeSuggestions,
	learnFromListening: listeningPreferences.learnFromListening,
	useLastfmHistory: listeningPreferences.useLastfmHistory,
	learnFromPlaylists: listeningPreferences.learnFromPlaylists
};

export const dbListeningPreferencesStore: ListeningPreferencesStore = {
	async read(userId) {
		const rows = await db
			.select(columns)
			.from(listeningPreferences)
			.where(eq(listeningPreferences.userId, userId))
			.limit(1);
		return rows[0] ? parseListeningPreferences(rows[0]) : null;
	},
	async write(userId, preferences) {
		const rows = await db
			.insert(listeningPreferences)
			.values({ userId, ...preferences, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: listeningPreferences.userId,
				set: { ...preferences, updatedAt: new Date() }
			})
			.returning(columns);
		return parseListeningPreferences(rows[0]);
	}
};

function clampCount(value: number): number {
	return Number.isFinite(value) ? Math.max(5, Math.min(25, Math.round(value))) : 10;
}

export function parseListeningPreferences(value: ListeningPreferences): ListeningPreferences {
	return {
		autoplay: Boolean(value.autoplay),
		autoplayCount: clampCount(value.autoplayCount),
		personalizeSuggestions: Boolean(value.personalizeSuggestions),
		learnFromListening: Boolean(value.learnFromListening),
		useLastfmHistory: Boolean(value.useLastfmHistory),
		learnFromPlaylists: Boolean(value.learnFromPlaylists)
	};
}

/** Checkbox form fields: present (`on`/`true`) means enabled. */
export function parseListeningPreferencesForm(form: FormData): ListeningPreferences | null {
	const count = Number(form.get('autoplayCount'));
	if (!(AUTOPLAY_COUNTS as readonly number[]).includes(count)) return null;
	const flag = (name: string) => {
		const value = form.get(name)?.toString();
		return value === 'on' || value === 'true';
	};
	return {
		autoplay: flag('autoplay'),
		autoplayCount: count,
		personalizeSuggestions: flag('personalizeSuggestions'),
		learnFromListening: flag('learnFromListening'),
		useLastfmHistory: flag('useLastfmHistory'),
		learnFromPlaylists: flag('learnFromPlaylists')
	};
}

/** Fail-open: a missing row or an unavailable table yields the defaults. */
export async function getListeningPreferences(
	userId: string,
	store: ListeningPreferencesStore = dbListeningPreferencesStore
): Promise<ListeningPreferences> {
	try {
		return (await store.read(userId)) ?? { ...DEFAULT_LISTENING_PREFERENCES };
	} catch (cause) {
		log.warn('listening preferences unavailable; using defaults', {
			cause: cause instanceof Error ? cause.name : 'UnknownError'
		});
		return { ...DEFAULT_LISTENING_PREFERENCES };
	}
}

export async function saveListeningPreferences(
	userId: string,
	preferences: ListeningPreferences,
	store: ListeningPreferencesStore = dbListeningPreferencesStore
): Promise<ListeningPreferences> {
	return store.write(userId, parseListeningPreferences(preferences));
}

/**
 * Shared by the desktop and mobile settings actions. Turning Last.fm off also
 * removes the Last.fm evidence already stored, so the choice takes effect now.
 */
export async function saveListeningPreferencesForm(
	userId: string,
	form: FormData,
	clearLastfm: (userId: string) => Promise<void>
): Promise<ListeningPreferences | null> {
	const next = parseListeningPreferencesForm(form);
	if (!next) return null;
	const saved = await saveListeningPreferences(userId, next);
	if (!saved.useLastfmHistory) await clearLastfm(userId);
	return saved;
}
