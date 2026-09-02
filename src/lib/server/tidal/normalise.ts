import type {
	AlbumReference,
	AlbumSummary,
	ArtistReference,
	ArtistSummary,
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

function imageUrl(resource: ResourceLike): string | undefined {
	return (
		readAttribute(resource, ['imageUrl', 'coverUrl', 'image', 'cover']) ??
		readAttribute(resource, ['image'])
	);
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

	for (const relationship of Object.values(resource.relationships)) {
		if (!isRecord(relationship)) continue;
		const data = relationship.data;
		const linkages = Array.isArray(data) ? data : [data];

		for (const linkage of linkages) {
			const identifier = readResource(linkage);
			if (!identifier || identifier.type !== type) continue;

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

	const image = imageUrl(resource) ?? (album ? imageUrl(album) : undefined);
	return {
		kind: 'track',
		id: resource.id,
		title: resourceTitle(resource),
		artists: relatedResources(resource, 'artists', included).map(normaliseArtistReference),
		...(album ? { album: normaliseAlbumReference(album) } : {}),
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
export function normaliseTrackDetail(document: unknown): TrackDetail | null {
	if (!isRecord(document)) return null;

	const track = normaliseTrack(document.data, indexIncluded(document.included));
	return track;
}

/** Return a display-ready album, or `null` for malformed/non-album input. */
export function normaliseAlbum(
	value: unknown,
	included: IncludedResources = new Map()
): AlbumSummary | null {
	const resource = readResource(value);
	if (!resource || resource.type !== 'albums') return null;

	const image = imageUrl(resource);
	return {
		kind: 'album',
		id: resource.id,
		title: resourceTitle(resource),
		artists: relatedResources(resource, 'artists', included).map(normaliseArtistReference),
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
	return { kind: 'artist', id: resource.id, name: resourceTitle(resource) };
}

/** Return a display-ready playlist, or `null` for malformed/non-playlist input. */
export function normalisePlaylist(value: unknown): PlaylistSummary | null {
	const resource = readResource(value);
	if (!resource || resource.type !== 'playlists') return null;
	return { kind: 'playlist', id: resource.id, title: resourceTitle(resource) };
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
