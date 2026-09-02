export type TidalResourceType = 'track' | 'album' | 'artist' | 'playlist' | 'mix' | 'video';

export const VALID_RESOURCE_TYPES: readonly TidalResourceType[] = [
	'track',
	'album',
	'artist',
	'playlist',
	'mix',
	'video'
] as const;

export interface ParsedTidalResource {
	type: TidalResourceType;
	id: string;
	url: string;
	appPath: string;
}

/**
 * Parses any TIDAL URL or shorthand string (e.g. `track/12345`, `https://listen.tidal.com/album/456`)
 * into a structured resource with Syn app routes.
 * Translates tiddl/cli/utils/resource.py:TidalResource.from_string.
 */
export function parseTidalResource(input: string | null | undefined): ParsedTidalResource | null {
	if (!input) return null;

	const trimmed = input.trim();
	if (!trimmed) return null;

	let pathname = trimmed;

	// Extract pathname if a full URL is provided
	try {
		if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
			const parsedUrl = new URL(trimmed);
			pathname = parsedUrl.pathname;
		}
	} catch {
		// Not a valid URL, treat as raw path/shorthand
	}

	// Split by '/' and clean empty segments
	const segments = pathname
		.split('/')
		.map((s) => s.trim())
		.filter(Boolean);

	// Find the matching resource type segment
	const typeIndex = segments.findIndex((seg) =>
		(VALID_RESOURCE_TYPES as readonly string[]).includes(seg.toLowerCase())
	);

	if (typeIndex === -1 || typeIndex + 1 >= segments.length) {
		return null;
	}

	const rawType = segments[typeIndex].toLowerCase() as TidalResourceType;
	const id = segments[typeIndex + 1];

	// For numeric types (track, album, video, artist), ensure the ID is valid or alphanumeric
	if (['track', 'album', 'video', 'artist'].includes(rawType) && !/^\d+$/.test(id)) {
		return null;
	}

	// Determine Syn in-app navigation route
	let appPath: string;
	switch (rawType) {
		case 'track':
			appPath = `/app/tracks/${id}`;
			break;
		case 'album':
			appPath = `/app/albums/${id}`;
			break;
		case 'artist':
			appPath = `/app/artists/${id}`;
			break;
		case 'playlist':
			appPath = `/app/playlists/${id}`;
			break;
		case 'mix':
			appPath = `/app/mixes?mixId=${encodeURIComponent(id)}`;
			break;
		default:
			appPath = `/app/search?q=${encodeURIComponent(id)}`;
			break;
	}

	return {
		type: rawType,
		id,
		url: `https://listen.tidal.com/${rawType}/${id}`,
		appPath
	};
}
