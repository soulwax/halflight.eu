import { StreamLoader, StreamPreloader } from 'syn.js/player';

/** The client-safe body of `GET /api/tracks/[id]/stream`. */
export interface PreloadedStreamData {
	audioQuality?: string;
	audioMode?: string;
	requestedQuality?: string | null;
	codecs?: string;
	fileExtension?: string;
	bitDepth?: number | null;
	sampleRate?: number | null;
	trackReplayGain?: number | null;
	isPreview?: boolean;
	requiresFullAuth?: boolean;
}

function parseStreamData(body: unknown): PreloadedStreamData | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const source = body as Record<string, unknown>;
	if (typeof source.audioQuality !== 'string' && typeof source.audioMode !== 'string') return null;
	const data: PreloadedStreamData = {};
	for (const key of ['audioQuality', 'audioMode', 'codecs', 'fileExtension'] as const) {
		if (typeof source[key] === 'string' && source[key].length <= 128) data[key] = source[key];
	}
	if (
		source.requestedQuality === null ||
		(typeof source.requestedQuality === 'string' && source.requestedQuality.length <= 128)
	)
		data.requestedQuality = source.requestedQuality;
	for (const key of ['bitDepth', 'sampleRate', 'trackReplayGain'] as const) {
		const value = source[key];
		if (value === null || (typeof value === 'number' && Number.isFinite(value))) data[key] = value;
	}
	for (const key of ['isPreview', 'requiresFullAuth'] as const) {
		if (typeof source[key] === 'boolean') data[key] = source[key];
	}
	return data;
}

/** The package fetches/decodes; Syn supplies the endpoint and safe display contract. */
export const streamLoader = new StreamLoader<PreloadedStreamData>({
	url: (trackId) => `/api/tracks/${encodeURIComponent(trackId)}/stream`,
	parse: parseStreamData,
	parseError(body, status) {
		const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
		return {
			requiresAuth:
				typeof source.requiresFullAuth === 'boolean' ? source.requiresFullAuth : status === 403,
			reason:
				typeof source.reason === 'string' && /^[a-z0-9_]{1,64}$/.test(source.reason)
					? source.reason
					: `http_${status}`
		};
	}
});

export async function loadStreamData(trackId: string): Promise<PreloadedStreamData | null> {
	const result = await streamLoader.load(trackId);
	return result.ok ? result.data : null;
}

/** Look-ahead cache so the next queued track starts without a `/stream` round trip. */
export const streamPreloader = new StreamPreloader<PreloadedStreamData>({ load: loadStreamData });
