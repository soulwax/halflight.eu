import { error, json, type RequestHandler } from '@sveltejs/kit';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userPlaylist } from '#lib/server/db/schema';
import { parsePlaybackTrack } from '#lib/server/playback-state';
import { playlistEditVersion } from '#lib/server/playlists/edit-version';
import type { TrackSummary } from '#lib/tidal/models';
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || !locals.isListener) error(401, 'Unauthorized');
	const body = await request.json().catch(() => null);
	if (
		!body ||
		typeof body.title !== 'string' ||
		!body.title.trim() ||
		body.title.length > 200 ||
		typeof body.description !== 'string' ||
		body.description.length > 4000 ||
		typeof body.version !== 'string' ||
		!Array.isArray(body.items) ||
		body.items.length > 5000
	)
		error(400, 'Invalid playlist edits');
	const [row] = await db
		.select()
		.from(userPlaylist)
		.where(and(eq(userPlaylist.id, params.id!), eq(userPlaylist.userId, locals.user.id)))
		.limit(1);
	if (!row) error(404, 'Playlist not found');
	const existing = JSON.parse(row.itemsJson) as TrackSummary[];
	if (
		playlistEditVersion({
			title: row.title,
			description: row.description,
			items: existing,
			updatedAt: row.updatedAt.toISOString()
		}) !== body.version
	)
		error(409, 'Playlist changed');
	const items: TrackSummary[] = body.items.map(
		(item: { sourceIndex?: unknown; track?: unknown }) => {
			if (!item || typeof item !== 'object') error(400, 'Invalid song');
			if (item.sourceIndex !== undefined) {
				if (
					typeof item.sourceIndex !== 'number' ||
					!Number.isInteger(item.sourceIndex) ||
					item.sourceIndex < 0 ||
					item.sourceIndex >= existing.length
				)
					error(400, 'Invalid occurrence');
				return existing[item.sourceIndex];
			}
			const track = parsePlaybackTrack(item.track);
			if (!track) error(400, 'Invalid song');
			return track;
		}
	);
	const changed = await db
		.update(userPlaylist)
		.set({
			title: body.title.trim(),
			description: body.description.trim() || null,
			itemsJson: JSON.stringify(items),
			syncStatus: 'local_only',
			updatedAt: new Date()
		})
		.where(
			and(
				eq(userPlaylist.id, row.id),
				eq(userPlaylist.userId, locals.user.id),
				eq(userPlaylist.itemsJson, row.itemsJson),
				eq(userPlaylist.title, row.title),
				row.description === null
					? isNull(userPlaylist.description)
					: eq(userPlaylist.description, row.description),
				sql`date_trunc('milliseconds', ${userPlaylist.updatedAt}) = ${row.updatedAt.toISOString()}::timestamptz`
			)
		)
		.returning({ id: userPlaylist.id });
	if (!changed.length) error(409, 'Playlist changed');
	return json({ saved: true }, { headers: { 'Cache-Control': 'private, no-store' } });
};
