import { error, redirect } from '@sveltejs/kit';
import {
	MAX_PRIVATE_MUSIC_FILE_BYTES,
	MAX_PRIVATE_MUSIC_TOTAL_BYTES,
	PRIVATE_MUSIC_FORMATS,
	dbPrivateMusicStore
} from '#lib/server/private-music';
import { privateMusicBucket } from '#lib/server/private-music-bucket';
import { filterPlayableTracks, getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseCollectionPage } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

type LibraryKind = 'albums' | 'artists' | 'tracks' | 'playlists';

const KINDS: LibraryKind[] = ['albums', 'artists', 'tracks', 'playlists'];

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');
	if (!event.locals.isListener) error(403, 'Forbidden');
	const files = await dbPrivateMusicStore.list(event.locals.user.id);
	const usedBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
	const privateMusic = {
		enabled: privateMusicBucket.enabled,
		formats: PRIVATE_MUSIC_FORMATS.map(({ label, contentType, extensions }) => ({
			label,
			contentType,
			extensions: [...extensions]
		})),
		storage: {
			fileCount: files.length,
			usedBytes,
			availableBytes: Math.max(0, MAX_PRIVATE_MUSIC_TOTAL_BYTES - usedBytes),
			maxTotalBytes: MAX_PRIVATE_MUSIC_TOTAL_BYTES,
			maxFileBytes: MAX_PRIVATE_MUSIC_FILE_BYTES
		},
		files: files.map(({ id, fileName, contentType, sizeBytes, createdAt }) => ({
			id,
			fileName,
			contentType,
			sizeBytes,
			createdAt,
			downloadUrl: `/api/private-music/${id}`
		}))
	};

	let connection: Awaited<ReturnType<typeof getConnectionStatus>>;
	try {
		connection = await getConnectionStatus();
	} catch {
		return { connected: false, sections: null, privateMusic };
	}
	if (!connection.connected) {
		return { connected: false, sections: null, privateMusic };
	}

	const results = await Promise.all(
		KINDS.map(async (kind) => {
			try {
				const document = await tidalApi.getCollectionPage(
					kind,
					{ include: ['artists', 'albums'] },
					{
						fetch: event.fetch,
						cookies: event.cookies
					}
				);

				const page = normaliseCollectionPage(document);
				return { kind, ok: true as const, page };
			} catch {
				return { kind, ok: false as const };
			}
		})
	);

	return {
		connected: true,
		hasWriteScopes: Boolean(connection.hasWriteScopes),
		privateMusic,
		sections: await Promise.all(
			results.map(async (result) => {
				if (!result.ok) return { kind: result.kind, ok: false as const };
				const items =
					result.kind === 'tracks'
						? await filterPlayableTracks(result.page.tracks)
						: result.page[result.kind];
				return {
					kind: result.kind,
					ok: true as const,
					items,
					hasMore: result.page.hasMore
				};
			})
		)
	};
};
