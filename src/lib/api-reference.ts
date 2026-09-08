export type ApiMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiGroup = 'library' | 'listening' | 'music' | 'storage';

export interface ApiEndpoint {
	id: string;
	group: ApiGroup;
	method: ApiMethod;
	path: string;
	/** Concrete, read-only request that the in-app workbench may execute. */
	examplePath?: string;
	requestExample?: string;
	responseExample: string;
}

/**
 * The owner-facing HTTP surface. Keep this list deliberately curated: each entry
 * is an application route with a stable client-safe response, never a provider
 * URL or a route that accepts bearer credentials.
 */
export const apiEndpoints: ApiEndpoint[] = [
	{
		id: 'search',
		group: 'music',
		method: 'GET',
		path: '/api/search?search={query}',
		examplePath: '/api/search?search=Boards%20of%20Canada',
		responseExample: '{ "results": { "tracks": [], "albums": [], "artists": [], "playlists": [] } }'
	},
	{
		id: 'favorites',
		group: 'library',
		method: 'GET',
		path: '/api/favorites',
		examplePath: '/api/favorites',
		responseExample: '{ "connected": true, "favorites": { "tracks": [], "albums": [] } }'
	},
	{
		id: 'playback-state-read',
		group: 'listening',
		method: 'GET',
		path: '/api/playback-state',
		examplePath: '/api/playback-state',
		responseExample: '{ "revision": 4, "queue": [], "position": 0 }'
	},
	{
		id: 'playback-state-save',
		group: 'listening',
		method: 'PUT',
		path: '/api/playback-state',
		requestExample: '{\n  "revision": 4,\n  "origin": "listening-room",\n  "queue": []\n}',
		responseExample: '{ "revision": 5, "queue": [], "position": 0 }'
	},
	{
		id: 'playback-intent',
		group: 'listening',
		method: 'POST',
		path: '/api/playback-state/intents',
		requestExample: '{\n  "revision": 4,\n  "intent": "clear-queue"\n}',
		responseExample: '{ "revision": 5, "queue": [] }'
	},
	{
		id: 'playlists-list',
		group: 'library',
		method: 'GET',
		path: '/api/playlists',
		examplePath: '/api/playlists',
		responseExample: '{ "playlists": [] }'
	},
	{
		id: 'playlists-create',
		group: 'library',
		method: 'POST',
		path: '/api/playlists',
		requestExample:
			'{\n  "title": "Night drive",\n  "description": "",\n  "items": [],\n  "syncTidal": false\n}',
		responseExample: '{ "playlist": { "id": "…", "title": "Night drive", "items": [] } }'
	},
	{
		id: 'taste-profile',
		group: 'library',
		method: 'GET',
		path: '/api/taste/profile',
		examplePath: '/api/taste/profile',
		responseExample: '{ "profile": { "artists": [], "genres": [] } }'
	},
	{
		id: 'private-music-list',
		group: 'storage',
		method: 'GET',
		path: '/api/private-music',
		examplePath: '/api/private-music',
		responseExample: '{ "storage": { "usedBytes": 0 }, "files": [] }'
	},
	{
		id: 'private-music-upload',
		group: 'storage',
		method: 'POST',
		path: '/api/private-music',
		requestExample: 'multipart/form-data\nfile: <audio file>',
		responseExample: '{ "id": "…", "downloadUrl": "/api/private-music/…" }'
	},
	{
		id: 'private-music-export',
		group: 'storage',
		method: 'GET',
		path: '/api/private-music/export?format={m3u8|json}',
		examplePath: '/api/private-music/export?format=json',
		responseExample: '200 application/json or audio/x-mpegurl attachment'
	},
	{
		id: 'private-music-download',
		group: 'storage',
		method: 'GET',
		path: '/api/private-music/{id}',
		responseExample: '200 audio stream · Range and ETag supported'
	},
	{
		id: 'track-metadata',
		group: 'music',
		method: 'GET',
		path: '/api/tracks/{id}/metadata',
		responseExample: '{ "track": { "id": "…", "title": "…" } }'
	},
	{
		id: 'track-stream',
		group: 'music',
		method: 'GET',
		path: '/api/tracks/{id}/stream',
		responseExample: '{ "stream": { "quality": "LOSSLESS", "mimeType": "audio/flac" } }'
	},
	{
		id: 'track-audio',
		group: 'music',
		method: 'GET',
		path: '/api/tracks/{id}/audio',
		responseExample: '206 audio stream · Range supported'
	}
];

export const apiGroups: ApiGroup[] = ['listening', 'music', 'library', 'storage'];

export function endpointsForGroup(group: ApiGroup): ApiEndpoint[] {
	return apiEndpoints.filter((endpoint) => endpoint.group === group);
}

type OpenApiOperation = {
	operationId: string;
	tags: string[];
	summary: string;
	responses: Record<string, { description: string }>;
	requestBody?: { required: boolean; content: Record<string, { example: unknown }> };
};

function openApiPath(path: string): string {
	return path.split('?')[0] ?? path;
}

function openApiRequestBody(endpoint: ApiEndpoint): OpenApiOperation['requestBody'] {
	if (!endpoint.requestExample) return undefined;
	if (endpoint.requestExample.startsWith('multipart/form-data')) {
		return {
			required: true,
			content: { 'multipart/form-data': { example: { file: '<audio file>' } } }
		};
	}
	try {
		return {
			required: true,
			content: { 'application/json': { example: JSON.parse(endpoint.requestExample) } }
		};
	} catch {
		return undefined;
	}
}

/** A compact OpenAPI 3.1 document for the same curated owner surface as the workbench. */
export function createOpenApiDocument(): {
	openapi: '3.1.0';
	info: { title: string; version: string; description: string };
	paths: Record<string, Record<string, OpenApiOperation>>;
} {
	const paths: Record<string, Record<string, OpenApiOperation>> = {};
	for (const endpoint of apiEndpoints) {
		const path = openApiPath(endpoint.path);
		const method = endpoint.method.toLowerCase();
		const operation: OpenApiOperation = {
			operationId: endpoint.id,
			tags: [endpoint.group],
			summary: endpoint.id.replaceAll('-', ' '),
			responses: {
				'200': { description: endpoint.responseExample }
			}
		};
		const requestBody = openApiRequestBody(endpoint);
		if (requestBody) operation.requestBody = requestBody;
		(paths[path] ??= {})[method] = operation;
	}

	return {
		openapi: '3.1.0',
		info: {
			title: 'Halflight owner API',
			version: '1.0.0',
			description:
				'Owner-only same-origin endpoints. Browser sessions authenticate requests; this document never contains credentials, provider URLs, or storage object keys.'
		},
		paths
	};
}
