/**
 * Typed helpers over the TIDAL API v2 (JSON:API). Every helper is a thin wrapper
 * around {@link tidalJson}; anything not covered here is still reachable through
 * `tidalJson('/whatever')` or the `/tidal/api/*` proxy route.
 */
import type { PlaylistSummary } from '#lib/tidal/models';
import { getAccessToken, tidalFetch, tidalJson, type TidalRequestContext } from './client';
import { TIDAL_API_BASE } from './config';
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
	collapseBy?: string;
	/** `page[cursor]` value for the next page. */
	cursor?: string;
}

/**
 * Playlist item links are relationship identifiers, not track documents. TIDAL
 * therefore requires nested include paths to side-load each track's artists
 * and album (`items.artists`, rather than a top-level `artists`). Flat paths
 * are rejected with a 400 `GENERIC_REQUEST_ERROR`.
 */
function playlistIncludes(include: string[] = []): string[] {
	return [
		...new Set([
			'items',
			...include.map((path) => (path === 'artists' || path === 'albums' ? `items.${path}` : path))
		])
	];
}

const MAX_PAGINATION_PAGES = 50;

async function collectPages(
	firstPage: Document<Resource[]>,
	ctx: Ctx | undefined,
	operation: string
): Promise<{ items: Resource[]; included: Resource[] }> {
	const items: Resource[] = [];
	const included: Resource[] = [];
	let page = firstPage;

	for (let pageCount = 0; ; pageCount += 1) {
		items.push(...(Array.isArray(page.data) ? page.data : [page.data]));
		included.push(...(page.included ?? []));
		const next = page.links?.next;
		if (!next) return { items, included };
		if (pageCount + 1 >= MAX_PAGINATION_PAGES) {
			// A partial playlist is worse than a visible import failure: it silently
			// changes the owner's ordered selection. Make the caller retry instead.
			throw new Error(`TIDAL ${operation} pagination did not finish.`);
		}
		// TIDAL controls the pagination token format. Following the supplied link
		// avoids assuming cursor pagination when an endpoint changes its scheme.
		page = await tidalJson<Document<Resource[]>>(next, {}, ctx);
	}
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
	return collectPages(await getCollectionPage(kind, opts, ctx), ctx, `${kind} collection`);
}

interface LegacyPlaylistPage {
	items?: unknown;
	total?: unknown;
}

function readLegacyPlaylistPage(value: unknown): { items: unknown[]; total?: number } {
	if (Array.isArray(value)) return { items: value };
	if (!value || typeof value !== 'object') return { items: [] };

	const page = value as LegacyPlaylistPage;
	return {
		items: Array.isArray(page.items) ? page.items : [],
		total: typeof page.total === 'number' && Number.isFinite(page.total) ? page.total : undefined
	};
}

function normaliseLegacyPlaylist(value: unknown): PlaylistSummary | null {
	if (!value || typeof value !== 'object') return null;
	const playlist = value as Record<string, unknown>;
	const id = typeof playlist.uuid === 'string' ? playlist.uuid : playlist.id;
	if (typeof id !== 'string' || !id) return null;

	return {
		kind: 'playlist',
		id,
		title: typeof playlist.title === 'string' && playlist.title ? playlist.title : id,
		...(typeof playlist.description === 'string' && playlist.description
			? { description: playlist.description }
			: {}),
		...(typeof playlist.numberOfTracks === 'number' && Number.isFinite(playlist.numberOfTracks)
			? { numberOfItems: playlist.numberOfTracks }
			: {})
	};
}

/**
 * List every playlist created by the authenticated TIDAL user. The v2 user
 * collection only covers saved playlists, while this legacy endpoint is the
 * authoritative owner list needed by the import workflow.
 */
export async function getOwnedPlaylists(
	tidalUserId: string,
	ctx?: Ctx
): Promise<PlaylistSummary[]> {
	const playlists: PlaylistSummary[] = [];
	const seen = new Set<string>();
	const limit = 100;

	for (let offset = 0; offset < 5_000;) {
		const page = readLegacyPlaylistPage(
			await tidalJson(
				`https://api.tidal.com/v1/users/${encodeURIComponent(tidalUserId)}/playlists?limit=${limit}&offset=${offset}`,
				{},
				ctx
			)
		);

		for (const item of page.items) {
			const playlist = normaliseLegacyPlaylist(item);
			if (playlist && !seen.has(playlist.id)) {
				seen.add(playlist.id);
				playlists.push(playlist);
			}
		}

		const nextOffset = offset + page.items.length;
		if (
			page.items.length === 0 ||
			(page.total !== undefined ? nextOffset >= page.total : page.items.length < limit)
		) {
			break;
		}
		offset = nextOffset;
	}

	return playlists;
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
			// This endpoint's primary data is already the playlist's tracks. Its
			// direct resource includes are therefore rooted at the tracks, unlike
			// `GET /playlists/:id`, which starts at the playlist document.
			include: ['items', ...(opts.include ?? [])],
			'page[cursor]': opts.cursor,
			countryCode: opts.countryCode
		})}`,
		{},
		ctx
	);
}

/** Every item in one playlist, following its cursor until exhaustion. */
export async function getFullPlaylistItems(
	id: string,
	ctx?: Ctx,
	opts: PageOptions = {}
): Promise<{ items: Resource[]; included: Resource[] }> {
	return collectPages(await getPlaylistItems(id, opts, ctx), ctx, 'playlist item');
}

/**
 * Fetches a playlist and ensures all items are populated by following item pagination
 * if the initial response was truncated (e.g. capped at 20 items by TIDAL's default include limit).
 */
export async function getFullPlaylist(
	id: string,
	opts: PageOptions = {},
	ctx?: Ctx
): Promise<Document<Resource>> {
	const document = await getPlaylist(id, { ...opts, include: playlistIncludes(opts.include) }, ctx);
	const data = document.data as Resource | undefined;
	if (!data) return document;

	const relationships = (data.relationships ?? {}) as Record<
		string,
		{ data?: Resource | Resource[]; links?: { next?: string } }
	>;
	const itemsRel = relationships.items;
	const initialItems = itemsRel?.data
		? Array.isArray(itemsRel.data)
			? itemsRel.data
			: [itemsRel.data]
		: [];
	const attrs = (data.attributes ?? {}) as Record<string, unknown>;
	const numberOfItemsAttr = attrs.numberOfItems ?? attrs.numberOfTracks;
	const expectedCount = typeof numberOfItemsAttr === 'number' ? numberOfItemsAttr : undefined;
	const hasNext = Boolean(itemsRel?.links?.next);

	if (
		hasNext ||
		(expectedCount !== undefined && expectedCount > initialItems.length) ||
		initialItems.length === 0
	) {
		const fullItems = await getFullPlaylistItems(id, ctx, {
			countryCode: opts.countryCode,
			include: ['artists', 'albums']
		});
		if (expectedCount !== undefined && fullItems.items.length < expectedCount) {
			throw new Error('TIDAL playlist items were incomplete.');
		}
		return {
			...document,
			data: {
				...data,
				relationships: {
					...relationships,
					items: {
						...(itemsRel ?? {}),
						data: fullItems.items
					}
				}
			},
			included: [...(document.included ?? []), ...fullItems.included, ...fullItems.items]
		};
	}

	return document;
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
			'page[cursor]': opts.cursor,
			collapseBy: opts.collapseBy
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

/** PATCH /playlists/{id} — update title and/or description. */
export function updatePlaylist(
	id: string,
	attrs: { title?: string; description?: string },
	ctx?: Ctx
): Promise<Document<Resource>> {
	return tidalJson(
		`/playlists/${encodeURIComponent(id)}`,
		{
			method: 'PATCH',
			body: JSON.stringify({
				data: { type: 'playlists', id, attributes: attrs }
			})
		},
		ctx
	);
}

/** DELETE /playlists/{id} — permanently delete a playlist from TIDAL. */
export async function deletePlaylistRemote(id: string, ctx?: Ctx): Promise<void> {
	const f = ctx?.fetch ?? fetch;
	const token = await getAccessToken(ctx);
	const res = await f(`${TIDAL_API_BASE}/playlists/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/vnd.api+json'
		}
	});
	if (!res.ok && res.status !== 204) {
		throw new TidalApiError(res.status, res.statusText, await res.text(), `/playlists/${id}`);
	}
}

/** DELETE /playlists/{id}/relationships/items — remove specific tracks from a playlist. */
export async function removePlaylistItems(
	playlistId: string,
	items: Array<{ id: string; type?: 'tracks' | 'videos' }>,
	ctx?: Ctx
): Promise<void> {
	// Chunk to batches of 50
	const BATCH_SIZE = 50;
	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const batch = items.slice(i, i + BATCH_SIZE);
		const f = ctx?.fetch ?? fetch;
		const token = await getAccessToken(ctx);
		const res = await f(
			`${TIDAL_API_BASE}/playlists/${encodeURIComponent(playlistId)}/relationships/items`,
			{
				method: 'DELETE',
				headers: {
					authorization: `Bearer ${token}`,
					'content-type': 'application/vnd.api+json'
				},
				body: JSON.stringify({
					data: batch.map((it) => ({ id: it.id, type: it.type ?? 'tracks' }))
				})
			}
		);
		if (!res.ok && res.status !== 204) {
			throw new TidalApiError(
				res.status,
				res.statusText,
				await res.text(),
				`/playlists/${playlistId}/relationships/items`
			);
		}
	}
}

/** PUT /playlists/{id}/relationships/items — replace all items (for reorder). */
export async function replacePlaylistItems(
	playlistId: string,
	items: Array<{ id: string; type?: 'tracks' | 'videos' }>,
	ctx?: Ctx
): Promise<void> {
	const f = ctx?.fetch ?? fetch;
	const token = await getAccessToken(ctx);
	const res = await f(
		`${TIDAL_API_BASE}/playlists/${encodeURIComponent(playlistId)}/relationships/items`,
		{
			method: 'PUT',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/vnd.api+json'
			},
			body: JSON.stringify({
				data: items.map((it) => ({ id: it.id, type: it.type ?? 'tracks' }))
			})
		}
	);
	if (!res.ok && res.status !== 204) {
		throw new TidalApiError(
			res.status,
			res.statusText,
			await res.text(),
			`/playlists/${playlistId}/relationships/items`
		);
	}
}
