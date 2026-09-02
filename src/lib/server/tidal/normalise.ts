import type {
	AlbumDetail,
	AlbumReference,
	AlbumSummary,
	ArtistDetail,
	ArtistReference,
	ArtistSummary,
	MixDetail,
	PlaylistDetail,
	PlaylistSummary,
	SearchResult,
	SearchResultGroups,
	TrackDetail,
	TrackSummary
} from './models';

type ResourceType = 'tracks' | 'albums' | 'artists' | 'playlists';

interface ResourceLike {
	id: string;
	type: string;
	attributes: Record<string, unknown>;
	relationships: Record<string, unknown>;
}

type IncludedResources = ReadonlyMap<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readResource(value: unknown): ResourceLike | null {
	if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string')
		return null;
	if (!value.id || !value.type) return null;

	return {
		id: value.id,
		type: value.type,
		attributes: isRecord(value.attributes) ? value.attributes : {},
		relationships: isRecord(value.relationships) ? value.relationships : {}
	};
}

function readAttribute(resource: ResourceLike, names: string[]): string | undefined {
	for (const name of names) {
		const value = resource.attributes[name];
		if (typeof value === 'string' && value.length > 0) return value;
	}
}

function readNumberAttribute(resource: ResourceLike, names: string[]): number | undefined {
	for (const name of names) {
		const value = resource.attributes[name];
		if (typeof value === 'number' && Number.isFinite(value)) return value;
	}
}

function readBooleanAttribute(resource: ResourceLike, names: string[]): boolean | undefined {
	for (const name of names) {
		const value = resource.attributes[name];
		if (typeof value === 'boolean') return value;
	}
}

function formatTidalCdnImage(idOrUrl: string, size = '640x640'): string {
	if (!idOrUrl || typeof idOrUrl !== 'string') return '';
	const trimmed = idOrUrl.trim();
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}
	const path = trimmed.replace(/-/g, '/');
	return `https://resources.tidal.com/images/${path}/${size}.jpg`;
}

function imageUrl(resource: ResourceLike): string | undefined {
	// 1. Direct string attribute
	const direct = readAttribute(resource, [
		'imageUrl',
		'coverUrl',
		'image',
		'cover',
		'picture',
		'avatar',
		'artwork',
		'albumCover',
		'squareImage'
	]);
	if (direct) return formatTidalCdnImage(direct);

	// 2. imageLinks or images array in attributes
	for (const key of ['imageLinks', 'images', 'covers', 'artworks', 'pictures']) {
		const arr = resource.attributes[key];
		if (Array.isArray(arr) && arr.length > 0) {
			for (const item of arr) {
				if (isRecord(item)) {
					const href =
						typeof item.href === 'string'
							? item.href
							: typeof item.url === 'string'
								? item.url
								: undefined;
					if (href) return formatTidalCdnImage(href);
				} else if (typeof item === 'string') {
					return formatTidalCdnImage(item);
				}
			}
		}
	}

	// 3. Object-based cover/image/artwork in attributes
	for (const key of ['albumCover', 'cover', 'image', 'picture', 'artwork']) {
		const obj = resource.attributes[key];
		if (isRecord(obj)) {
			const href =
				typeof obj.href === 'string'
					? obj.href
					: typeof obj.url === 'string'
						? obj.url
						: typeof obj.id === 'string'
							? obj.id
							: undefined;
			if (href) return formatTidalCdnImage(href);
		}
	}
}

function resourceTitle(resource: ResourceLike): string {
	return readAttribute(resource, ['title', 'name']) ?? resource.id;
}

function includedKey(resource: Pick<ResourceLike, 'id' | 'type'>): string {
	return `${resource.type}:${resource.id}`;
}

/**
 * Resolve resources of one type from all relationship linkages on a resource.
 *
 * We use the linked resource type rather than depending on relationship names,
 * which keeps this boundary tolerant of additive API changes.
 */
function relatedResources(
	resource: ResourceLike,
	type: ResourceType,
	included: IncludedResources
): ResourceLike[] {
	const related: ResourceLike[] = [];
	const seen = new Set<string>();

	for (const [relName, relationship] of Object.entries(resource.relationships)) {
		if (!isRecord(relationship)) continue;
		const data = relationship.data;
		const linkages = Array.isArray(data) ? data : [data];

		for (const linkage of linkages) {
			const identifier = readResource(linkage);
			if (!identifier) continue;
			if (identifier.type !== type && !relName.toLowerCase().startsWith(type.slice(0, 4))) continue;

			const resolved = readResource(included.get(includedKey(identifier))) ?? identifier;
			const key = includedKey(resolved);
			if (!seen.has(key)) {
				seen.add(key);
				related.push(resolved);
			}
		}
	}

	return related;
}

function normaliseArtistReference(resource: ResourceLike): ArtistReference {
	return { id: resource.id, name: resourceTitle(resource) };
}

function normaliseAlbumReference(resource: ResourceLike): AlbumReference {
	return {
		id: resource.id,
		title: resourceTitle(resource),
		...(imageUrl(resource) ? { imageUrl: imageUrl(resource) } : {}),
		...(readAttribute(resource, ['releaseDate', 'release_date'])
			? { releaseDate: readAttribute(resource, ['releaseDate', 'release_date']) }
			: {})
	};
}

/** Return a display-ready track, or `null` for malformed/non-track input. */
export function normaliseTrack(
	value: unknown,
	included: IncludedResources = new Map()
): TrackSummary | null {
	const resource = readResource(value);
	if (!resource || resource.type !== 'tracks') return null;
	const album = relatedResources(resource, 'albums', included)[0];

	// 1. Artists: from relationships or fallback to attributes
	let artists = relatedResources(resource, 'artists', included).map(normaliseArtistReference);
	if (!artists.length) {
		const rawArtists = resource.attributes.artists ?? resource.attributes.artist;
		if (Array.isArray(rawArtists)) {
			artists = rawArtists
				.map((a: unknown) => {
					if (isRecord(a)) {
						return { id: String(a.id ?? ''), name: String(a.name ?? a.title ?? '') };
					}
					if (typeof a === 'string') return { id: '', name: a };
					return null;
				})
				.filter((a): a is ArtistReference => Boolean(a && a.name));
		} else if (typeof resource.attributes.artistName === 'string') {
			artists = [{ id: '', name: resource.attributes.artistName }];
		} else if (typeof resource.attributes.artist === 'string') {
			artists = [{ id: '', name: resource.attributes.artist }];
		} else if (typeof resource.attributes.artistsText === 'string') {
			artists = [{ id: '', name: resource.attributes.artistsText }];
		}
	}

	// 2. Album: from relationships or fallback to attributes
	let albumRef = album ? normaliseAlbumReference(album) : undefined;
	if (!albumRef) {
		const rawAlbum = resource.attributes.album;
		if (isRecord(rawAlbum)) {
			const albumResource = readResource(rawAlbum) ?? {
				id: String(rawAlbum.id ?? ''),
				type: 'albums',
				attributes: rawAlbum,
				relationships: {}
			};
			albumRef = normaliseAlbumReference(albumResource);
		} else if (typeof resource.attributes.albumTitle === 'string') {
			albumRef = {
				id: '',
				title: resource.attributes.albumTitle,
				imageUrl: imageUrl(resource)
			};
		}
	}

	// 3. Image: resolve from track, album, or albumRef
	const image = imageUrl(resource) ?? (album ? imageUrl(album) : undefined) ?? albumRef?.imageUrl;

	return {
		kind: 'track',
		id: resource.id,
		title: resourceTitle(resource),
		artists,
		...(albumRef ? { album: albumRef } : {}),
		...(readNumberAttribute(resource, ['duration', 'durationSeconds'])
			? { duration: readNumberAttribute(resource, ['duration', 'durationSeconds']) }
			: {}),
		...(readNumberAttribute(resource, ['trackNumber', 'track_number'])
			? { trackNumber: readNumberAttribute(resource, ['trackNumber', 'track_number']) }
			: {}),
		...(readNumberAttribute(resource, ['volumeNumber', 'volume_number'])
			? { volumeNumber: readNumberAttribute(resource, ['volumeNumber', 'volume_number']) }
			: {}),
		...(readBooleanAttribute(resource, ['explicit']) !== undefined
			? { explicit: readBooleanAttribute(resource, ['explicit']) }
			: {}),
		...(readAttribute(resource, ['audioQuality', 'audio_quality'])
			? { audioQuality: readAttribute(resource, ['audioQuality', 'audio_quality']) }
			: {}),
		...(readAttribute(resource, ['isrc']) ? { isrc: readAttribute(resource, ['isrc']) } : {}),
		...(readNumberAttribute(resource, ['popularity']) !== undefined
			? { popularity: readNumberAttribute(resource, ['popularity']) }
			: {}),
		...(readAttribute(resource, ['copyright'])
			? { copyright: readAttribute(resource, ['copyright']) }
			: {}),
		...(image ? { imageUrl: image } : {})
	};
}

/**
 * Convert a single-track JSON:API compound document into the safe contract
 * consumed by the track page. Raw attributes and relationships never leave
 * this server boundary.
 */
export function normaliseTrackDetail(
	document: unknown,
	radioDoc?: unknown,
	artistTracksDoc?: unknown
): TrackDetail | null {
	if (!isRecord(document)) return null;

	const track = normaliseTrack(document.data, indexIncluded(document.included));
	if (!track) return null;

	const radioTracks = radioDoc
		? normaliseSearchResults(radioDoc).tracks.filter((t) => t.id !== track.id)
		: [];
	const artistTopTracks = artistTracksDoc
		? normaliseSearchResults(artistTracksDoc).tracks.filter((t) => t.id !== track.id)
		: [];

	return {
		...track,
		...(radioTracks.length ? { radioTracks } : {}),
		...(artistTopTracks.length ? { artistTopTracks } : {})
	};
}

/** Return a display-ready album, or `null` for malformed/non-album input. */
export function normaliseAlbum(
	value: unknown,
	included: IncludedResources = new Map()
): AlbumSummary | null {
	const resource = readResource(value);
	if (!resource || resource.type !== 'albums') return null;

	const image = imageUrl(resource);
	let artists = relatedResources(resource, 'artists', included).map(normaliseArtistReference);
	if (!artists.length) {
		const rawArtists = resource.attributes.artists ?? resource.attributes.artist;
		if (Array.isArray(rawArtists)) {
			artists = rawArtists
				.map((a: unknown) => {
					if (isRecord(a)) {
						return { id: String(a.id ?? ''), name: String(a.name ?? a.title ?? '') };
					}
					if (typeof a === 'string') return { id: '', name: a };
					return null;
				})
				.filter((a): a is ArtistReference => Boolean(a && a.name));
		} else if (typeof resource.attributes.artistName === 'string') {
			artists = [{ id: '', name: resource.attributes.artistName }];
		} else if (typeof resource.attributes.artist === 'string') {
			artists = [{ id: '', name: resource.attributes.artist }];
		}
	}

	return {
		kind: 'album',
		id: resource.id,
		title: resourceTitle(resource),
		artists,
		...(image ? { imageUrl: image } : {}),
		...(readAttribute(resource, ['releaseDate', 'release_date'])
			? { releaseDate: readAttribute(resource, ['releaseDate', 'release_date']) }
			: {}),
		...(readBooleanAttribute(resource, ['explicit']) !== undefined
			? { explicit: readBooleanAttribute(resource, ['explicit']) }
			: {}),
		...(readNumberAttribute(resource, ['popularity']) !== undefined
			? { popularity: readNumberAttribute(resource, ['popularity']) }
			: {}),
		...(readAttribute(resource, ['copyright'])
			? { copyright: readAttribute(resource, ['copyright']) }
			: {})
	};
}

/** Return a display-ready artist, or `null` for malformed/non-artist input. */
export function normaliseArtist(value: unknown): ArtistSummary | null {
	const resource = readResource(value);
	if (!resource || resource.type !== 'artists') return null;
	const image = imageUrl(resource);
	const popularity = readNumberAttribute(resource, ['popularity']);
	return {
		kind: 'artist',
		id: resource.id,
		name: resourceTitle(resource),
		...(image ? { imageUrl: image } : {}),
		...(popularity !== undefined ? { popularity } : {})
	};
}

/** Return a display-ready playlist, or `null` for malformed/non-playlist input. */
export function normalisePlaylist(value: unknown): PlaylistSummary | null {
	const resource = readResource(value);
	if (!resource || resource.type !== 'playlists') return null;
	const image = imageUrl(resource);
	const description = readAttribute(resource, ['description']);
	const numberOfItems = readNumberAttribute(resource, ['numberOfItems', 'numberOfTracks']);
	return {
		kind: 'playlist',
		id: resource.id,
		title: resourceTitle(resource),
		...(description ? { description } : {}),
		...(image ? { imageUrl: image } : {}),
		...(numberOfItems !== undefined ? { numberOfItems } : {})
	};
}

/**
 * Convert an album compound document into a display-ready AlbumDetail model,
 * resolving album artists and ordered track items from linkages or included resources.
 */
export function normaliseAlbumDetail(
	document: unknown,
	similarAlbumsDoc?: unknown
): AlbumDetail | null {
	if (!isRecord(document)) return null;
	const resource = readResource(document.data);
	if (!resource || resource.type !== 'albums') return null;

	const included = indexIncluded(document.included);
	const base = normaliseAlbum(resource, included);
	if (!base) return null;

	const tracks: TrackSummary[] = [];
	const seen = new Set<string>();

	const itemRel = resource.relationships.items ?? resource.relationships.tracks;
	if (isRecord(itemRel)) {
		const linkages = Array.isArray(itemRel.data) ? itemRel.data : [itemRel.data];
		for (const linkage of linkages) {
			const ident = readResource(linkage);
			if (!ident) continue;
			const resolved = readResource(included.get(includedKey(ident))) ?? ident;
			const track = normaliseTrack(resolved, included);
			if (track && !seen.has(track.id)) {
				seen.add(track.id);
				if (!track.album) {
					track.album = {
						id: base.id,
						title: base.title,
						...(base.imageUrl ? { imageUrl: base.imageUrl } : {}),
						...(base.releaseDate ? { releaseDate: base.releaseDate } : {})
					};
				}
				tracks.push(track);
			}
		}
	}

	if (!tracks.length) {
		for (const item of included.values()) {
			const ident = readResource(item);
			if (ident && ident.type === 'tracks') {
				const track = normaliseTrack(ident, included);
				if (track && !seen.has(track.id)) {
					seen.add(track.id);
					if (!track.album) {
						track.album = {
							id: base.id,
							title: base.title,
							...(base.imageUrl ? { imageUrl: base.imageUrl } : {}),
							...(base.releaseDate ? { releaseDate: base.releaseDate } : {})
						};
					}
					tracks.push(track);
				}
			}
		}
	}

	tracks.sort((a, b) => {
		const volA = a.volumeNumber ?? 1;
		const volB = b.volumeNumber ?? 1;
		if (volA !== volB) return volA - volB;
		const numA = a.trackNumber ?? 0;
		const numB = b.trackNumber ?? 0;
		return numA - numB;
	});

	const duration =
		readNumberAttribute(resource, ['duration', 'durationSeconds']) ??
		(tracks.length ? tracks.reduce((acc, t) => acc + (t.duration ?? 0), 0) : undefined);
	const numberOfItems =
		readNumberAttribute(resource, ['numberOfItems', 'numberOfTracks', 'totalTracks']) ??
		(tracks.length ? tracks.length : undefined);
	const numberOfVolumes = readNumberAttribute(resource, [
		'numberOfVolumes',
		'numberOfDiscs',
		'totalVolumes'
	]);
	const audioQuality = readAttribute(resource, ['audioQuality', 'audio_quality']);
	const similarAlbums = similarAlbumsDoc
		? normaliseSearchResults(similarAlbumsDoc).albums.filter((a) => a.id !== base.id)
		: [];

	return {
		...base,
		items: tracks,
		...(duration ? { duration } : {}),
		...(numberOfItems !== undefined ? { numberOfItems } : {}),
		...(numberOfVolumes !== undefined ? { numberOfVolumes } : {}),
		...(audioQuality ? { audioQuality } : {}),
		...(similarAlbums.length ? { similarAlbums } : {})
	};
}

/**
 * Normalise an artist document combined with optional side-loaded tracks, albums,
 * similar artists, and radio tracks documents.
 */
export function normaliseArtistDetail(
	document: unknown,
	tracksDoc?: unknown,
	albumsDoc?: unknown,
	similarDoc?: unknown,
	radioDoc?: unknown
): ArtistDetail | null {
	if (!isRecord(document)) return null;
	const resource = readResource(document.data);
	if (!resource || resource.type !== 'artists') return null;

	const base = normaliseArtist(resource);
	if (!base) return null;

	const image = imageUrl(resource);
	const popularity = readNumberAttribute(resource, ['popularity']);

	const topTracks = tracksDoc ? normaliseSearchResults(tracksDoc).tracks : [];
	const albums = albumsDoc ? normaliseSearchResults(albumsDoc).albums : [];
	const similarArtists = similarDoc ? normaliseSearchResults(similarDoc).artists : [];
	const radioTracks = radioDoc ? normaliseSearchResults(radioDoc).tracks : [];

	return {
		...base,
		...(image ? { imageUrl: image } : {}),
		...(popularity !== undefined ? { popularity } : {}),
		topTracks,
		albums,
		similarArtists,
		...(radioTracks.length ? { radioTracks } : {})
	};
}

/**
 * Normalise a playlist compound document with ordered items and metadata.
 */
export function normalisePlaylistDetail(document: unknown): PlaylistDetail | null {
	if (!isRecord(document)) return null;
	const resource = readResource(document.data);
	if (!resource || resource.type !== 'playlists') return null;

	const included = indexIncluded(document.included);
	const base = normalisePlaylist(resource);
	if (!base) return null;

	const image = imageUrl(resource);
	const description = readAttribute(resource, ['description']);
	const accessType = readAttribute(resource, ['accessType', 'access_type']);

	const tracks: TrackSummary[] = [];
	const seen = new Set<string>();

	const itemRel = resource.relationships.items ?? resource.relationships.tracks;
	if (isRecord(itemRel)) {
		const linkages = Array.isArray(itemRel.data) ? itemRel.data : [itemRel.data];
		for (const linkage of linkages) {
			const ident = readResource(linkage);
			if (!ident) continue;
			const resolved = readResource(included.get(includedKey(ident))) ?? ident;
			const track = normaliseTrack(resolved, included);
			if (track && !seen.has(track.id)) {
				seen.add(track.id);
				tracks.push(track);
			}
		}
	}

	if (!tracks.length) {
		for (const item of included.values()) {
			const ident = readResource(item);
			if (ident && ident.type === 'tracks') {
				const track = normaliseTrack(ident, included);
				if (track && !seen.has(track.id)) {
					seen.add(track.id);
					tracks.push(track);
				}
			}
		}
	}

	const duration =
		readNumberAttribute(resource, ['duration', 'durationSeconds']) ??
		(tracks.length ? tracks.reduce((acc, t) => acc + (t.duration ?? 0), 0) : undefined);
	const numberOfItems =
		readNumberAttribute(resource, ['numberOfItems', 'numberOfTracks']) ??
		(tracks.length ? tracks.length : undefined);

	let creator: { id?: string; name?: string } | undefined;
	const creatorRel = resource.relationships.creator ?? resource.relationships.owner;
	if (isRecord(creatorRel)) {
		const ident = readResource(creatorRel.data);
		if (ident) {
			const resolved = readResource(included.get(includedKey(ident))) ?? ident;
			creator = { id: resolved.id, name: resourceTitle(resolved) };
		}
	}

	return {
		...base,
		...(description ? { description } : {}),
		...(image ? { imageUrl: image } : {}),
		...(creator ? { creator } : {}),
		...(duration ? { duration } : {}),
		...(numberOfItems !== undefined ? { numberOfItems } : {}),
		...(accessType ? { accessType } : {}),
		items: tracks
	};
}

/**
 * Normalise a personalised mix (e.g. Daily, Discovery, New Arrivals) with its tracks.
 */
export function normaliseMixDetail(document: unknown, mixType: string = 'daily'): MixDetail | null {
	if (!isRecord(document)) return null;
	const resource = readResource(document.data);
	if (!resource) return null;

	const included = indexIncluded(document.included);
	const title = resourceTitle(resource);
	const subtitle = readAttribute(resource, ['subTitle', 'subtitle', 'description']);
	const image = imageUrl(resource);

	const tracks: TrackSummary[] = [];
	const seen = new Set<string>();

	const itemRel = resource.relationships.items ?? resource.relationships.tracks;
	if (isRecord(itemRel)) {
		const linkages = Array.isArray(itemRel.data) ? itemRel.data : [itemRel.data];
		for (const linkage of linkages) {
			const ident = readResource(linkage);
			if (!ident) continue;
			const resolved = readResource(included.get(includedKey(ident))) ?? ident;
			const track = normaliseTrack(resolved, included);
			if (track && !seen.has(track.id)) {
				seen.add(track.id);
				tracks.push(track);
			}
		}
	}

	if (!tracks.length) {
		for (const item of included.values()) {
			const ident = readResource(item);
			if (ident && ident.type === 'tracks') {
				const track = normaliseTrack(ident, included);
				if (track && !seen.has(track.id)) {
					seen.add(track.id);
					tracks.push(track);
				}
			}
		}
	}

	return {
		kind: 'mix',
		id: resource.id,
		title,
		...(subtitle ? { subtitle } : {}),
		mixType,
		...(image ? { imageUrl: image } : {}),
		items: tracks
	};
}

/** Normalise one supported media resource without exposing its JSON:API shape. */
export function normaliseSearchResult(
	value: unknown,
	included: IncludedResources = new Map()
): SearchResult | null {
	const resource = readResource(value);
	if (!resource) return null;

	switch (resource.type) {
		case 'tracks':
			return normaliseTrack(resource, included);
		case 'albums':
			return normaliseAlbum(resource, included);
		case 'artists':
			return normaliseArtist(resource);
		case 'playlists':
			return normalisePlaylist(resource);
		default:
			return null;
	}
}

/** Display-ready collection page: grouped items plus a "more pages exist" flag. */
export interface CollectionPage extends SearchResultGroups {
	hasMore: boolean;
}

/**
 * Convert a `userCollection*` relationship page (`data` linkages + side-loaded
 * `included` resources) into display-ready groups. Unresolved linkages are kept
 * where they still carry a usable id/type.
 */
export function normaliseCollectionPage(document: unknown): CollectionPage {
	const groups: CollectionPage = {
		tracks: [],
		albums: [],
		artists: [],
		playlists: [],
		hasMore: false
	};
	if (!isRecord(document)) return groups;

	const included = indexIncluded(document.included);
	const linkages = Array.isArray(document.data)
		? document.data
		: document.data !== undefined
			? [document.data]
			: [];
	const seen = new Set<string>();

	for (const linkage of linkages) {
		const identifier = readResource(linkage);
		if (!identifier) continue;
		const resolved = included.get(includedKey(identifier)) ?? linkage;
		addResource(groups, resolved, included, seen);
	}

	if (!seen.size) {
		for (const resource of included.values()) addResource(groups, resource, included, seen);
	}

	const next = isRecord(document.links) ? document.links.next : undefined;
	groups.hasMore = typeof next === 'string' && next.length > 0;

	return groups;
}

function indexIncluded(value: unknown): Map<string, unknown> {
	const index = new Map<string, unknown>();
	if (!Array.isArray(value)) return index;

	for (const item of value) {
		const resource = readResource(item);
		if (resource) index.set(includedKey(resource), item);
	}

	return index;
}

function addResource(
	groups: SearchResultGroups,
	resource: unknown,
	included: IncludedResources,
	seen: Set<string>
): void {
	const item = normaliseSearchResult(resource, included);
	if (!item) return;

	const key = `${item.kind}:${item.id}`;
	if (seen.has(key)) return;
	seen.add(key);

	switch (item.kind) {
		case 'track':
			groups.tracks.push(item);
			break;
		case 'album':
			groups.albums.push(item);
			break;
		case 'artist':
			groups.artists.push(item);
			break;
		case 'playlist':
			groups.playlists.push(item);
	}
}

/**
 * Convert a search JSON:API document into display-ready result groups.
 *
 * Search endpoint roots can either be media resources themselves or a container
 * resource with media relationship linkages. If neither shape is present, the
 * side-loaded media resources are used as a safe fallback.
 */
export function normaliseSearchResults(document: unknown): SearchResultGroups {
	const groups: SearchResultGroups = { tracks: [], albums: [], artists: [], playlists: [] };
	if (!isRecord(document)) return groups;

	const roots = Array.isArray(document.data) ? document.data : [document.data];
	const included = indexIncluded(document.included);
	const seen = new Set<string>();
	let foundResult = false;

	for (const root of roots) {
		const resource = readResource(root);
		if (!resource) continue;

		const before = seen.size;
		addResource(groups, root, included, seen);
		if (seen.size === before) {
			for (const type of ['tracks', 'albums', 'artists', 'playlists'] as const) {
				for (const related of relatedResources(resource, type, included)) {
					addResource(groups, related, included, seen);
				}
			}
		}
		foundResult ||= seen.size > before;
	}

	if (!foundResult) {
		for (const resource of included.values()) addResource(groups, resource, included, seen);
	}

	return groups;
}
