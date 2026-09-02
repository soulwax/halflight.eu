import { pgTable, serial, integer, text, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

/**
 * Single-row store for the personal TIDAL OAuth token record. `secret` holds the
 * AES-256-GCM ciphertext (base64 of `iv || authTag || ciphertext`) of the JSON
 * token record; the plaintext never touches the database.
 */
export const tidalAuth = pgTable(
	'tidal_auth',
	{
		id: integer('id').primaryKey().notNull().default(1),
		secret: text('secret').notNull(),
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

export * from './auth.schema';
