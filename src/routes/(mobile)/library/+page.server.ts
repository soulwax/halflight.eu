import { error, redirect } from '@sveltejs/kit';
import {
	MAX_PRIVATE_MUSIC_FILE_BYTES,
	MAX_PRIVATE_MUSIC_TOTAL_BYTES,
	PRIVATE_MUSIC_FORMATS,
	dbPrivateMusicStore
} from '#lib/server/private-music';
import { privateMusicBucket } from '#lib/server/private-music-bucket';
import { getUserPlaylists } from '#lib/server/playlists';
import {
	filterPlayableTracks,
	getConnectionStatus,
	getUnplayableTrackIds,
	tidalApi
} from '#lib/server/tidal';
import { normaliseCollectionPage } from '#lib/server/tidal/normalise';
import type { MobileLibraryData } from '#lib/tidal/mobile-library';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async (event): Promise<MobileLibraryData> => {
	if (!event.locals.user) redirect(302, '/sign-in');
	if (!event.locals.isListener) error(403, 'Forbidden');

	const tabParam = event.url.searchParams.get('tab');
	const tab = tabParam === 'private' || tabParam === 'tracks' ? tabParam : 'saved';
	const query = (event.url.searchParams.get('q') ?? '').trim().slice(0, 120);
	let files: Awaited<ReturnType<typeof dbPrivateMusicStore.list>> = [];
	let privateUnavailable = false;
	if (tab === 'private') {
		try {
			files = await dbPrivateMusicStore.list(event.locals.user.id);
		} catch {
			privateUnavailable = true;
		}
	}
	const usedBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
	const result: MobileLibraryData = {
		tab,
		status: privateUnavailable ? 'unavailable' : 'ready',
		privateMusic: {
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
		},
		playlists: [],
		tracks: [],
		previousQuery: null,
		nextQuery: null,
		hasMore: false,
		query,
		hiddenTrackCount: 0
	};

	try {
		if (tab === 'private') return result;
		if (tab === 'saved') {
			const ownedPlaylists = await getUserPlaylists(event.locals.user.id);
			const needle = query.toLocaleLowerCase();
			const playlists = needle
				? ownedPlaylists.filter((playlist) =>
						[
							playlist.title,
							...playlist.items.flatMap((track) => [
								track.title,
								track.album?.title ?? '',
								...track.artists.map((artist) => artist.name)
							])
						].some((text) => text.toLocaleLowerCase().includes(needle))
					)
				: ownedPlaylists;
			const requestedPage = Number(event.url.searchParams.get('page') ?? 1);
			const lastPage = Math.max(1, Math.ceil(playlists.length / PAGE_SIZE));
			const page =
				Number.isSafeInteger(requestedPage) && requestedPage > 0
					? Math.min(requestedPage, lastPage)
					: 1;
			const pagePlaylists = playlists
				.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
				.map(({ id, title, items }) => ({ id, title, items }));
			const unplayable = await getUnplayableTrackIds(
				pagePlaylists.flatMap((playlist) => playlist.items.map((item) => item.id))
			);
			result.playlists = pagePlaylists.map((playlist) => ({
				...playlist,
				totalTrackCount: playlist.items.length,
				items: playlist.items.filter((item) => !unplayable.has(item.id))
			}));
			result.hiddenTrackCount = result.playlists.reduce(
				(count, playlist) =>
					count + (playlist.totalTrackCount ?? playlist.items.length) - playlist.items.length,
				0
			);
			const pageQuery = (target: number) =>
				new URLSearchParams({
					tab: 'saved',
					page: String(target),
					...(query ? { q: query } : {})
				}).toString();
			result.previousQuery = page > 1 ? pageQuery(page - 1) : null;
			result.nextQuery = page < lastPage ? pageQuery(page + 1) : null;
			return result;
		}

		const connection = await getConnectionStatus();
		if (!connection.connected) return { ...result, status: 'disconnected' };
		const cursor = event.url.searchParams.get('cursor') || undefined;
		if (cursor && cursor.length > 2048) return { ...result, status: 'unavailable' };
		const document = await tidalApi.getCollectionPage(
			'tracks',
			{
				include: ['artists', 'albums'],
				cursor
			},
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const collection = normaliseCollectionPage(document);
		result.tracks = await filterPlayableTracks(collection.tracks);
		result.hiddenTrackCount = collection.tracks.length - result.tracks.length;
		result.hasMore = collection.hasMore;
		result.previousQuery = cursor ? 'tab=tracks' : null;
		// Only forward an opaque cursor to the fixed collection endpoint. Provider
		// pagination URLs and other query fields never become client navigation.
		if (document.links?.next) {
			const next = new URL(document.links.next, 'https://openapi.tidal.com').searchParams.get(
				'page[cursor]'
			);
			if (next && next.length <= 2048 && next !== cursor) {
				result.nextQuery = new URLSearchParams({ tab: 'tracks', cursor: next }).toString();
			}
		}
		return result;
	} catch {
		return { ...result, status: 'unavailable' };
	}
};
