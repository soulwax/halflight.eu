import { StreamPreloader } from 'syn.js/player';

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

/** Resolve stream metadata for a track, or `null` when it is not directly playable. */
export async function loadStreamData(trackId: string): Promise<PreloadedStreamData | null> {
	if (typeof fetch === 'undefined') return null;
	const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/stream`);
	if (!res.ok) return null;
	return (await res.json().catch(() => null)) as PreloadedStreamData | null;
}

/** Look-ahead cache so the next queued track starts without a `/stream` round trip. */
export const streamPreloader = new StreamPreloader<PreloadedStreamData>({ load: loadStreamData });
