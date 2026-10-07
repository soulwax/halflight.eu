import { error, json, type RequestHandler } from '@sveltejs/kit';
import { playlistEditVersion } from '#lib/server/playlists/edit-version';
import { getUserPlaylists, createUserPlaylist } from '#lib/server/playlists';
export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || !locals.isListener) error(401, 'Unauthorized');
	const body = await request.json().catch(() => null);
	if (
		!body ||
		typeof body.title !== 'string' ||
		!body.title.trim() ||
		body.title.length > 200 ||
		typeof body.version !== 'string'
	)
		error(400, 'Invalid copy');
	const original = (await getUserPlaylists(locals.user.id)).find(
		(playlist) => playlist.id === params.id
	);
	if (!original) error(404, 'Playlist not found');
	if (playlistEditVersion(original) !== body.version) error(409, 'Playlist changed');
	const playlist = await createUserPlaylist({
		userId: locals.user.id,
		title: body.title,
		description: original.description ?? undefined,
		items: original.items,
		source: 'syn',
		syncStatus: 'local_only'
	});
	return json(
		{ id: playlist.id },
		{ status: 201, headers: { 'Cache-Control': 'private, no-store' } }
	);
};
