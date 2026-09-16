import {
	pgTable,
	integer,
	text,
	timestamp,
	boolean,
	check,
	jsonb,
	index,
	primaryKey,
	serial
} from 'drizzle-orm/pg-core';
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
 * Administrators for this Syn installation.
 * - The first bootstrapped administrator is assigned 'owner'.
 * - Other administrators can be granted 'admin' status.
 */
export const administrator = pgTable('administrator', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	role: text('role').notNull().default('admin'),
	grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow()
});

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
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	source: text('source').notNull().default('syn'),
	syncStatus: text('sync_status').notNull().default('local_only'),
	lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
	remoteEtag: text('remote_etag'),
	syncError: text('sync_error')
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
 * The owner's selected visual theme. Separate from `streaming_settings`
 * because appearance and audio preferences are different concerns that
 * change independently; a reconnect or quality change must never touch this.
 *
 * Deliberately no CHECK constraint on `theme`: the set of valid themes is
 * meant to grow (see `#lib/server/theme-settings.ts`'s `THEMES`), and that is
 * the single source of truth `saveThemeSettings` already validates every
 * write against — a DB-level enum would force a migration for every new
 * theme, which is exactly the friction this table is designed to avoid.
 */
export const userAppearance = pgTable('user_appearance', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	theme: text('theme').notNull().default('dark'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

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
	// New writes keep the entry-aware queue separately while rolling deployments
	// can still read the legacy snapshot column.
	queueEntriesJson: text('queue_entries_json').notNull().default('[]'),
	historyJson: text('history_json').notNull().default('[]'),
	currentTime: integer('current_time').notNull().default(0),
	revision: integer('revision').notNull().default(0),
	lastOrigin: text('last_origin'),
	// An opaque, short-lived browser identity. It prevents a second open
	// Listening Room / Halflight Now session from advancing the saved position
	// until the owner deliberately takes playback there.
	activeDeviceId: text('active_device_id'),
	activeDeviceOrigin: text('active_device_origin'),
	activeDeviceExpiresAt: timestamp('active_device_expires_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Short-lived idempotency outcomes for accepted playback intents.
 *
 * The playback writer prunes this table by age and count in the same database
 * transaction as a state mutation. It is deliberately a small retry window,
 * never an append-only activity log; `resultJson` contains only the safe,
 * bounded result returned to the client.
 */
export const playbackOperationResult = pgTable(
	'playback_operation_result',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		operationId: text('operation_id').notNull(),
		requestFingerprint: text('request_fingerprint').notNull(),
		resultJson: text('result_json').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.operationId] }),
		index('playback_operation_result_user_created_idx').on(table.userId, table.createdAt),
		check(
			'playback_operation_result_operation_id_length',
			sql`char_length(${table.operationId}) between 1 and 128`
		)
	]
);

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

/**
 * A bounded, owner-owned suppression list for recently accepted generated
 * tracks. It deliberately holds identifiers and expiry only — no provider
 * display data, playback history, or generated-set payload.
 */
export const generationCooldown = pgTable(
	'generation_cooldown',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		trackId: text('track_id').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.trackId] }),
		index('generation_cooldown_user_expiry_idx').on(table.userId, table.expiresAt)
	]
);

/**
 * Owner-uploaded private music. The bytes remain only in the dedicated bucket;
 * Postgres holds the ownership, opaque object key, and download metadata.
 */
export const privateMusicFile = pgTable(
	'private_music_file',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		objectKey: text('object_key').notNull().unique(),
		fileName: text('file_name').notNull(),
		contentType: text('content_type').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('private_music_file_user_created_idx').on(table.userId, table.createdAt),
		check('private_music_file_size_positive', sql`${table.sizeBytes} > 0`)
	]
);

/** A user's encrypted Last.fm session key and scrobbling preferences. */
/**
 * The keys Syn has written to the short-lived TIDAL HiRes cache bucket, with
 * the moment each becomes reclaimable.
 *
 * This exists because the cache bucket supports neither `ListObjects` nor
 * lifecycle rules — verified against the live provider, which answers `NoSuchKey`
 * to both. Nothing can therefore enumerate the bucket to find expired objects,
 * so Syn has to remember what it wrote in order to delete it later. Rows hold an
 * opaque object key and a timestamp; no track identity, no URL, no audio.
 */
export const tidalCacheObject = pgTable(
	'tidal_cache_object',
	{
		objectKey: text('object_key').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		sizeBytes: integer('size_bytes').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('tidal_cache_object_expires_at_idx').on(table.expiresAt)]
);

/**
 * TIDAL track IDs confirmed unplayable — the catalogue entry exists but every
 * quality in `QUALITY_LADDER` failed to resolve a stream (removed recording,
 * region lock, licensing gap). Checked lazily: a row is written only when the
 * owner's own player or the stream-resolution route actually hits the
 * failure, never by a proactive sweep. Absence means "playable or not yet
 * attempted", not "confirmed playable" — this table only ever grows by
 * negative results. Track listings filter these out so a broken recording
 * disappears instead of erroring on play.
 */
export const trackPlayability = pgTable(
	'track_playability',
	{
		trackId: text('track_id').primaryKey(),
		reason: text('reason').notNull(),
		checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('track_playability_checked_at_idx').on(table.checkedAt)]
);

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

/** Account state for moderation: active, archived, or banned. */
export const userStatus = pgTable('user_status', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	status: text('status').notNull().default('active'), // 'active' | 'archived' | 'banned'
	reason: text('reason'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export * from './auth.schema';
