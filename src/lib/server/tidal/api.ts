/**
 * Typed helpers over the TIDAL API v2 (JSON:API). Every helper is a thin wrapper
 * around {@link tidalJson}; anything not covered here is still reachable through
 * `tidalJson('/whatever')` or the `/tidal/api/*` proxy route.
 */
import { tidalFetch, tidalJson, type TidalRequestContext } from './client';
import { TidalApiError } from './errors';
import type { Document, Resource } from './jsonapi';

type Ctx = TidalRequestContext;

export type CollectionKind = 'albums' | 'artists' | 'tracks' | 'videos' | 'playlists';
export type MixKind = 'daily' | 'discovery' | 'newRelease';

const MIX_RESOURCE: Record<MixKind, string> = {
	daily: 'userDailyMixes',
	discovery: 'userDiscoveryMixes',
	newRelease: 'userNewReleaseMixes'
};

function qs(params: Record<string, string | string[] | number | undefined>): string {
	const sp = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			if (value.length) sp.set(key, value.join(','));
		} else {
			sp.set(key, String(value));
		}
	}
	const s = sp.toString();
	return s ? `?${s}` : '';
}

export interface PageOptions {
	include?: string[];
	countryCode?: string;
	locale?: string;
	/** `page[cursor]` value for the next page. */
	cursor?: string;
}

/** The authenticated user's profile resource (`/users/me`). */
export function getCurrentUser(ctx?: Ctx): Promise<Document<Resource>> {
	return tidalJson(`/users/me`, {}, ctx);
}

/**
 * One page of the user's collection for a resource kind, with the referenced
 * items side-loaded via `include=items`.
 */
export function getCollectionPage(
	kind: CollectionKind,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource[]>> {
	const resource = `userCollection${kind[0].toUpperCase()}${kind.slice(1)}`;
	return tidalJson(
		`/${resource}/me/relationships/items${qs({
			include: ['items', ...(opts.include ?? [])],
			'page[cursor]': opts.cursor,
			locale: opts.locale
		})}`,
		{},
		ctx
	);
}

/** Every page of a collection kind, following `links.next` to exhaustion. */
export async function getFullCollection(
	kind: CollectionKind,
	ctx?: Ctx,
	opts: PageOptions = {}
): Promise<{ items: Resource[]; included: Resource[] }> {
	const items: Resource[] = [];
	const included: Resource[] = [];
	let cursor = opts.cursor;
	for (let guard = 0; guard < 50; guard++) {
		const page = await getCollectionPage(kind, { ...opts, cursor }, ctx);
		items.push(...(Array.isArray(page.data) ? page.data : [page.data]));
		included.push(...(page.included ?? []));
		const next = page.links?.next;
		if (!next) break;
		const parsed = new URL(next, 'https://openapi.tidal.com');
		cursor = parsed.searchParams.get('page[cursor]') ?? undefined;
		if (!cursor) break;
	}
	return { items, included };
}

/** A playlist and (optionally) its items. */
export function getPlaylist(
	id: string,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource>> {
	return tidalJson(
		`/playlists/${encodeURIComponent(id)}${qs({
			include: opts.include,
			countryCode: opts.countryCode,
			locale: opts.locale
		})}`,
		{},
		ctx
	);
}

export function getPlaylistItems(
	id: string,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource[]>> {
	return tidalJson(
		`/playlists/${encodeURIComponent(id)}/relationships/items${qs({
			include: ['items', ...(opts.include ?? [])],
			'page[cursor]': opts.cursor,
			countryCode: opts.countryCode
		})}`,
		{},
		ctx
	);
}

/** A personalised mix set and its tracks (`include=items`). */
export function getMix(
	kind: MixKind,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource>> {
	return tidalJson(
		`/${MIX_RESOURCE[kind]}/me${qs({
			include: ['items', ...(opts.include ?? [])],
			locale: opts.locale
		})}`,
		{},
		ctx
	);
}

/**
 * The user's recommendation hub in one call — discovery mixes, "my mixes" and
 * new-arrival mixes side-loaded.
 */
export function getRecommendations(opts: PageOptions = {}, ctx?: Ctx): Promise<Document<Resource>> {
	return tidalJson(
		`/userRecommendations/me${qs({
			include: ['discoveryMixes', 'myMixes', 'newArrivalMixes', ...(opts.include ?? [])],
			locale: opts.locale
		})}`,
		{},
		ctx
	);
}

export interface SearchOptions extends PageOptions {
	types?: Array<'tracks' | 'albums' | 'artists' | 'playlists' | 'videos' | 'topHits'>;
	explicitFilter?: 'INCLUDE' | 'EXCLUDE';
}

/** Catalogue search. Defaults to including tracks, albums and artists. */
export function search(
	query: string,
	opts: SearchOptions = {},
	ctx?: Ctx
): Promise<Document<Resource[]>> {
	const types = opts.types ?? ['tracks', 'albums', 'artists'];
	return tidalJson(
		`/searchResults${qs({
			'filter[query]': query,
			include: [...types, ...(opts.include ?? [])],
			countryCode: opts.countryCode,
			explicitFilter: opts.explicitFilter
		})}`,
		{},
		ctx
	);
}

const catalogue =
	(resource: 'tracks' | 'albums' | 'artists' | 'videos') =>
	(id: string, opts: PageOptions = {}, ctx?: Ctx): Promise<Document<Resource>> =>
		tidalJson(
			`/${resource}/${encodeURIComponent(id)}${qs({
				include: opts.include,
				countryCode: opts.countryCode,
				locale: opts.locale
			})}`,
			{},
			ctx
		);

export const getTrack = catalogue('tracks');
export const getAlbum = catalogue('albums');
export const getArtist = catalogue('artists');
export const getVideo = catalogue('videos');

/** A named relationship of an artist (`radio`, `similarArtists`, `tracks`, `albums`, `videos`, …). */
export function getArtistRelationship(
	id: string,
	relationship: string,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource[]>> {
	return tidalJson(
		`/artists/${encodeURIComponent(id)}/relationships/${relationship}${qs({
			include: opts.include,
			countryCode: opts.countryCode,
			'page[cursor]': opts.cursor
		})}`,
		{},
		ctx
	);
}

/** A named relationship of a track (`radio`, `similarTracks`, `albums`, `artists`, …). */
export function getTrackRelationship(
	id: string,
	relationship: string,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource[]>> {
	return tidalJson(
		`/tracks/${encodeURIComponent(id)}/relationships/${relationship}${qs({
			include: opts.include,
			countryCode: opts.countryCode,
			'page[cursor]': opts.cursor
		})}`,
		{},
		ctx
	);
}

/** A named relationship of an album (`similarAlbums`, `items`, `tracks`, `artists`, …). */
export function getAlbumRelationship(
	id: string,
	relationship: string,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource[]>> {
	return tidalJson(
		`/albums/${encodeURIComponent(id)}/relationships/${relationship}${qs({
			include: opts.include,
			countryCode: opts.countryCode,
			'page[cursor]': opts.cursor
		})}`,
		{},
		ctx
	);
}

async function mutate(method: string, path: string, body: unknown, ctx?: Ctx): Promise<unknown> {
	const response = await tidalFetch(
		path,
		{ method, headers: { 'content-type': 'application/vnd.api+json' }, body: JSON.stringify(body) },
		ctx
	);
	const text = await response.text();
	if (!response.ok) {
		throw new TidalApiError(response.status, response.statusText, text, `${method} ${path}`);
	}
	return text ? JSON.parse(text) : null;
}

/**
 * Add or remove items in the user's collection. The dedicated
 * `userCollection*` resources accept `me`; the item `type` is the plain
 * resource type (`albums`, `tracks`, …).
 */
async function mutateCollection(
	method: 'POST' | 'DELETE',
	kind: CollectionKind,
	ids: string[],
	ctx?: Ctx
): Promise<void> {
	const resource = `userCollection${kind[0].toUpperCase()}${kind.slice(1)}`;
	await mutate(
		method,
		`/${resource}/me/relationships/items`,
		{ data: ids.map((id) => ({ id, type: kind })) },
		ctx
	);
}

/** Add resources to the user's collection (max 50 ids per call). */
export function addToCollection(kind: CollectionKind, ids: string[], ctx?: Ctx): Promise<void> {
	return mutateCollection('POST', kind, ids, ctx);
}

/** Remove resources from the user's collection. */
export function removeFromCollection(
	kind: CollectionKind,
	ids: string[],
	ctx?: Ctx
): Promise<void> {
	return mutateCollection('DELETE', kind, ids, ctx);
}

export interface NewPlaylist {
	name: string;
	description?: string;
	accessType?: 'PUBLIC' | 'UNLISTED';
}

/** Create a playlist. Returns the created playlist document. */
export function createPlaylist(playlist: NewPlaylist, ctx?: Ctx): Promise<Document<Resource>> {
	return mutate(
		'POST',
		'/playlists',
		{ data: { type: 'playlists', attributes: playlist } },
		ctx
	) as Promise<Document<Resource>>;
}

/** Append tracks (or videos) to a playlist (max 50 per call). */
export function addPlaylistItems(
	playlistId: string,
	items: Array<{ id: string; type?: 'tracks' | 'videos' }>,
	ctx?: Ctx
): Promise<void> {
	return mutate(
		'POST',
		`/playlists/${encodeURIComponent(playlistId)}/relationships/items`,
		{ data: items.map((it) => ({ id: it.id, type: it.type ?? 'tracks' })) },
		ctx
	).then(() => undefined);
}
