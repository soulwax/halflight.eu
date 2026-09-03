import { TidalApiError, TidalError } from './errors';
import { getPlaybackToken, type TidalRequestContext } from './client';

export type TrackAudioQuality = 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';

/**
 * Single-file (BTS) qualities, best to worst. `HI_RES_LOSSLESS` is excluded — it
 * returns a segmented DASH manifest the single-URL proxy can't serve.
 */
export const BTS_QUALITY_LADDER: TrackAudioQuality[] = ['LOSSLESS', 'HIGH', 'LOW'];

/** TIDAL `subStatus` for "requested quality is not allowed in the user's subscription". */
const SUBSTATUS_QUALITY_NOT_ALLOWED = 5003;

/**
 * Every quality the account is entitled to was refused (`subStatus 5003`) — the
 * plan has no streaming entitlement (e.g. free tier or lapsed subscription).
 */
export class TidalQualityDeniedError extends TidalError {
	constructor(readonly triedQualities: TrackAudioQuality[]) {
		super('This TIDAL plan does not allow streaming playback at any available quality.');
	}
}

function subStatusOf(err: unknown): number | undefined {
	if (!(err instanceof TidalApiError)) return undefined;
	return (err.body as { subStatus?: number } | null)?.subStatus;
}

export interface TrackStreamResponse {
	trackId: number;
	assetPresentation: 'FULL';
	audioMode: 'STEREO' | 'DOLBY_ATMOS';
	audioQuality: TrackAudioQuality;
	manifestMimeType: 'application/dash+xml' | 'application/vnd.tidal.bts';
	manifestHash: string;
	manifest: string;
	albumReplayGain?: number | null;
	albumPeakAmplitude?: number | null;
	trackReplayGain?: number | null;
	trackPeakAmplitude?: number | null;
	bitDepth?: number | null;
	sampleRate?: number | null;
}

export interface BTSManifest {
	mimeType: string;
	codecs: string;
	encryptionType: string;
	urls: string[];
}

export interface ParsedTrackStream {
	urls: string[];
	fileExtension: string;
	mimeType: string;
	codecs: string;
}

export interface ResolvedStreamInfo {
	trackId: number;
	streamUrl: string;
	urls: string[];
	fileExtension: string;
	mimeType: string;
	codecs: string;
	audioMode: 'STEREO' | 'DOLBY_ATMOS';
	audioQuality: TrackAudioQuality;
	bitDepth?: number | null;
	sampleRate?: number | null;
}

const DOLBY_CODECS = new Set(['eac3', 'ac4']);

/**
 * Parses XML DASH manifest of a track stream, translating tiddl's parse_manifest_XML.
 */
export function parseManifestXml(xmlContent: string): { urls: string[]; codecs: string } {
	// Extract codecs attribute from Representation element
	const repMatch = xmlContent.match(/<Representation[^>]*codecs=["']([^"']+)["']/i);
	const codecs = repMatch ? repMatch[1] : '';

	// Extract media attribute from SegmentTemplate
	const segTemplateMatch = xmlContent.match(/<SegmentTemplate[^>]*media=["']([^"']+)["']/i);
	if (!segTemplateMatch) {
		throw new TidalError('SegmentTemplate element with media attribute not found in DASH manifest');
	}
	const urlTemplate = segTemplateMatch[1];

	// Match all <S> elements in SegmentTimeline
	const sRegex = /<S\b[^>]*\/?>/gi;
	const sMatches = xmlContent.match(sRegex);
	if (!sMatches || sMatches.length === 0) {
		throw new TidalError('SegmentTimeline S elements not found in DASH manifest');
	}

	let total = 0;
	for (const sTag of sMatches) {
		total += 1;
		const rMatch = sTag.match(/\br=["']?(\d+)["']?/i);
		if (rMatch) {
			total += parseInt(rMatch[1], 10);
		}
	}

	const urls: string[] = [];
	for (let i = 0; i <= total; i++) {
		urls.push(urlTemplate.replace('$Number$', String(i)));
	}

	return { urls, codecs };
}

/**
 * Parses URLs, codecs, and file extension from a TIDAL track stream manifest.
 * Translates tiddl/core/utils/parse.py:parse_track_stream.
 */
export function parseTrackStream(stream: TrackStreamResponse): ParsedTrackStream {
	const decodedManifest = Buffer.from(stream.manifest, 'base64').toString('utf-8');

	let urls: string[];
	let codecs: string;
	let mimeType: string;

	switch (stream.manifestMimeType) {
		case 'application/vnd.tidal.bts': {
			const parsed = JSON.parse(decodedManifest) as BTSManifest;
			urls = parsed.urls;
			codecs = parsed.codecs;
			mimeType = parsed.mimeType || (codecs === 'flac' ? 'audio/flac' : 'audio/mp4');
			break;
		}
		case 'application/dash+xml': {
			const parsed = parseManifestXml(decodedManifest);
			urls = parsed.urls;
			codecs = parsed.codecs;
			mimeType = codecs === 'flac' ? 'audio/flac' : 'audio/mp4';
			break;
		}
		default:
			throw new TidalError(`Unsupported manifestMimeType: ${stream.manifestMimeType}`);
	}

	let fileExtension: string;
	if (codecs === 'flac') {
		fileExtension = stream.audioQuality === 'HI_RES_LOSSLESS' ? '.m4a' : '.flac';
	} else if (codecs.startsWith('mp4') || DOLBY_CODECS.has(codecs)) {
		fileExtension = '.m4a';
	} else {
		throw new TidalError(`Unknown codecs '${codecs}' (trackId: ${stream.trackId})`);
	}

	return {
		urls,
		fileExtension,
		mimeType,
		codecs
	};
}

/**
 * Fetches full playback info for a track and parses the stream URLs.
 * Translates tiddl's TidalAPI.get_track_stream and parse_track_stream.
 */
export async function fetchTrackStream(
	trackId: string | number,
	options: {
		quality?: TrackAudioQuality;
		ctx?: TidalRequestContext;
		accessToken?: string;
	} = {}
): Promise<ResolvedStreamInfo> {
	const targetQuality = options.quality ?? 'HIGH';
	const token = options.accessToken ?? (await getPlaybackToken(options.ctx));
	const f = options.ctx?.fetch ?? fetch;

	// Query TIDAL API v1 playbackinfopostpaywall for FULL audio stream
	const url = `https://api.tidal.com/v1/tracks/${encodeURIComponent(String(trackId))}/playbackinfopostpaywall?audioquality=${targetQuality}&playbackmode=STREAM&assetpresentation=FULL`;

	const response = await f(url, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			body = null;
		}
		const errObj = body as { status?: number; subStatus?: number; userMessage?: string } | null;
		throw new TidalApiError(
			response.status,
			errObj?.userMessage || `TIDAL streaming API error (${response.status})`,
			errObj,
			url
		);
	}

	const data = (await response.json()) as TrackStreamResponse;
	const parsed = parseTrackStream(data);

	if (!parsed.urls || parsed.urls.length === 0) {
		throw new TidalError(`No stream URLs returned in manifest for track ${trackId}`);
	}

	return {
		trackId: data.trackId,
		streamUrl: parsed.urls[0],
		urls: parsed.urls,
		fileExtension: parsed.fileExtension,
		mimeType: parsed.mimeType,
		codecs: parsed.codecs,
		audioMode: data.audioMode,
		audioQuality: data.audioQuality,
		bitDepth: data.bitDepth,
		sampleRate: data.sampleRate
	};
}

/**
 * Resolve a playable single-file stream, walking **down** the quality ladder past
 * "quality not allowed in your subscription" responses so a HiFi request still
 * lands on `HIGH`/`LOW` for a lower-tier plan.
 *
 * @throws {TidalQualityDeniedError} when every tier is refused (no streaming plan)
 * @throws {TidalApiError | TidalPlaybackNotLinkedError | TidalAuthError} for other failures
 */
export async function resolveTrackStream(
	trackId: string | number,
	options: { quality?: TrackAudioQuality; ctx?: TidalRequestContext } = {}
): Promise<ResolvedStreamInfo> {
	const ladder =
		options.quality && !BTS_QUALITY_LADDER.includes(options.quality)
			? [options.quality, ...BTS_QUALITY_LADDER]
			: options.quality
				? [options.quality, ...BTS_QUALITY_LADDER.filter((q) => q !== options.quality)]
				: BTS_QUALITY_LADDER;

	const tried: TrackAudioQuality[] = [];
	let lastError: unknown;
	for (const quality of ladder) {
		tried.push(quality);
		try {
			return await fetchTrackStream(trackId, { quality, ctx: options.ctx });
		} catch (err) {
			lastError = err;
			if (subStatusOf(err) === SUBSTATUS_QUALITY_NOT_ALLOWED) continue;
			throw err;
		}
	}
	if (subStatusOf(lastError) === SUBSTATUS_QUALITY_NOT_ALLOWED) {
		throw new TidalQualityDeniedError(tried);
	}
	throw lastError;
}
