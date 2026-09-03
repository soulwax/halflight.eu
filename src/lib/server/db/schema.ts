import {
	pgTable,
	serial,
	integer,
	text,
	timestamp,
	boolean,
	check,
	real
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

/**
 * Single-row store for the personal TIDAL tokens. Both columns hold AES-256-GCM
 * ciphertext (base64 of `iv || authTag || ciphertext`) of a JSON token record;
 * plaintext never touches the database.
 *
 * - `secret` — the developer OAuth (authorization-code) token used for the
 *   JSON:API v2 browse surface (`openapi.tidal.com/v2`).
 * - `playbackSecret` — the TIDAL Link (device-authorization, `r_usr`) token used
 *   for the legacy `api.tidal.com/v1` playback/lyrics/credits surface.
 */
export const tidalAuth = pgTable(
	'tidal_auth',
	{
		id: integer('id').primaryKey().notNull().default(1),
		secret: text('secret'),
		playbackSecret: text('playback_secret'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [check('tidal_auth_singleton', sql`${t.id} = 1`)]
);

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
			sql`${table.preferredQuality} in ('LOW', 'HIGH', 'LOSSLESS')`
		),
		check('streaming_settings_volume', sql`${table.volume} between 0 and 100`)
	]
);

/**
 * Durable commands for the self-hosted streamrip worker. The worker and Syn
 * share this state, but neither side stores TIDAL bearer tokens, signed playback
 * tickets, CDN URLs, or conversion temp paths here.
 */
export const streamripJob = pgTable(
	'streamrip_job',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		trackId: text('track_id').notNull(),
		kind: text('kind').notNull(),
		status: text('status').notNull().default('queued'),
		requestedQuality: text('requested_quality').notNull().default('HIGH'),
		outputFormat: text('output_format').notNull().default('source'),
		workerJobId: text('worker_job_id').unique(),
		audioQuality: text('audio_quality'),
		mimeType: text('mime_type'),
		codecs: text('codecs'),
		fileExtension: text('file_extension'),
		bitDepth: integer('bit_depth'),
		sampleRate: integer('sample_rate'),
		trackReplayGain: real('track_replay_gain'),
		artifactKey: text('artifact_key'),
		artifactSize: integer('artifact_size'),
		errorCode: text('error_code'),
		attempts: integer('attempts').notNull().default(0),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		check('streamrip_job_kind', sql`${table.kind} in ('playback', 'download')`),
		check(
			'streamrip_job_status',
			sql`${table.status} in ('queued', 'preparing', 'ready', 'downloading', 'completed', 'failed', 'expired')`
		),
		check('streamrip_job_quality', sql`${table.requestedQuality} in ('LOW', 'HIGH', 'LOSSLESS')`),
		check(
			'streamrip_job_output_format',
			sql`${table.outputFormat} in ('source', 'flac', 'aac', 'mp3', 'opus')`
		)
	]
);

export * from './auth.schema';
