import { pgTable, integer, text, timestamp, boolean, check, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

/**
 * Per-user store for TIDAL tokens. Both columns hold AES-256-GCM
 * ciphertext (base64 of `iv || authTag || ciphertext`) of a JSON token record;
 * plaintext never touches the database.
 *
 * - `secret` — the developer OAuth (authorization-code) token used for the
 *   JSON:API v2 browse surface (`openapi.tidal.com/v2`).
 * - `playbackSecret` — the TIDAL Link (device-authorization, `r_usr`) token used
 *   for the legacy `api.tidal.com/v1` playback/lyrics/credits surface.
 */
export const tidalAuth = pgTable('tidal_auth', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	secret: text('secret'),
	playbackSecret: text('playback_secret'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * The one, permanent administrator for this personal installation. Owned by Syn
 * rather than Better Auth: it maps a Better Auth user id to owner status, with no
 * application path to reassign or delete it.
 */
export const administrator = pgTable(
	'administrator',
	{
		id: integer('id').primaryKey().notNull().default(1),
		userId: text('user_id').notNull().unique(),
		grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [check('administrator_singleton', sql`${table.id} = 1`)]
);

/**
 * Custom and generated playlists saved directly in the user's account.
 */
export const userPlaylist = pgTable('user_playlist', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	itemsJson: text('items_json').notNull().default('[]'),
	tidalPlaylistId: text('tidal_playlist_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Durable playback preferences. They are intentionally separate from OAuth
 * credentials, so a reconnect never resets the owner's listening setup.
 */
export const streamingSettings = pgTable(
	'streaming_settings',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		preferredQuality: text('preferred_quality').notNull().default('HIGH'),
		volume: integer('volume').notNull().default(100),
		loudnessNormalization: boolean('loudness_normalization').notNull().default(true),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		check(
			'streaming_settings_quality',
			sql`${table.preferredQuality} in ('LOW', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS')`
		),
		check('streaming_settings_volume', sql`${table.volume} between 0 and 100`)
	]
);

/**
 * The owner's resumable player state. This is deliberately bounded workflow
 * state, not a catalogue cache: it contains only the currently playing track,
 * a short queue/history, and the last known position. It never holds stream
 * URLs, audio bytes, or TIDAL credentials.
 */
export const playbackState = pgTable('playback_state', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	currentTrackJson: text('current_track_json'),
	queueJson: text('queue_json').notNull().default('[]'),
	historyJson: text('history_json').notNull().default('[]'),
	currentTime: integer('current_time').notNull().default(0),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * User visual preferences and customization settings.
 */
export const userSettings = pgTable('user_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	theme: text('theme').notNull().default('tokyo-night'),
	visualStyle: text('visual_style').notNull().default('bauhaus'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Syn-owned, derived listening preferences. This deliberately stores no TIDAL
 * catalogue text, artwork, audio, or event history: only identifiers and the
 * weights/controls calculated from the owner's live signals.
 */
export const tasteProfile = pgTable('taste_profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	data: jsonb('data').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** A user's encrypted Last.fm session key and scrobbling preferences. */
export const lastfmConnection = pgTable('lastfm_connection', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	username: text('username').notNull(),
	sessionKey: text('session_key').notNull(),
	scrobbleEnabled: boolean('scrobble_enabled').notNull().default(true),
	nowPlayingEnabled: boolean('now_playing_enabled').notNull().default(true),
	lastScrobbledAt: timestamp('last_scrobbled_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export * from './auth.schema';
