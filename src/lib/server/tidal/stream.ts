import { TidalApiError, TidalError } from './errors';
import { getPlaybackToken, type TidalRequestContext } from './client';
import { withTransientRetry } from './retry';

export type TrackAudioQuality = 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';

/**
 * Every streamable quality, best to worst. `resolveTrackStream` walks **down**
 * this ladder past "quality not allowed in your plan" (`subStatus 5003`), so a
 * HiRes request on a lower-tier subscription still lands on `LOSSLESS`/`HIGH`.
 *
 * `HI_RES_LOSSLESS` is a segmented DASH manifest (`initialization` + numbered
 * fragments); `LOW`/`HIGH`/`LOSSLESS` are single-file BTS manifests. Both are
 * handled — see `parseTrackStream` and `#lib/server/tidal/segmented`.
 */
export const QUALITY_LADDER: TrackAudioQuality[] = ['HI_RES_LOSSLESS', 'LOSSLESS', 'HIGH', 'LOW'];

/** TIDAL `subStatus` for "requested quality is not allowed in the user's subscription". */
const SUBSTATUS_QUALITY_NOT_ALLOWED = 5003;

/**
 * TIDAL's legacy playback endpoint uses this otherwise-auth-like response for
 * a catalogue item which has been removed or is not available to play. The
 * response is asset-specific, so callers must not present it as a request to
 * reconnect the account.
 */
export function isTrackUnavailableForPlayback(cause: unknown): boolean {
	return (
		cause instanceof TidalApiError &&
		cause.status === 401 &&
		/asset is not ready for playback/i.test(cause.statusText)
	);
}

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

/** Parsed MPEG-DASH audio manifest. Translated from OrpheusDL-TIDAL `parse_mpd`. */
export interface ParsedDashManifest {
	/** The `initialization` segment URL, or `null` when the template has none. */
	initUrl: string | null;
	/** Media fragment URLs, in play order (the init segment is not included here). */
	mediaUrls: string[];
	codecs: string;
	/** From `<Representation bandwidth>`, kbps. */
	bitrateKbps: number | null;
	/** From `<Representation audioSamplingRate>`, Hz. */
	sampleRateHz: number | null;
}

export interface ParsedTrackStream {
	/** Every URL to fetch, in order. For DASH the first entry is the init segment. */
	urls: string[];
	fileExtension: string;
	mimeType: string;
	codecs: string;
	/** `true` when `urls` is a segmented DASH stream that must be concatenated. */
	segmented: boolean;
	/** Precise bitrate from the DASH manifest, kbps. `null` for single-file BTS. */
	bitrateKbps: number | null;
	/** Precise sample rate from the DASH manifest, Hz. `null` for single-file BTS. */
	sampleRateHz: number | null;
}

export interface ResolvedStreamInfo {
	trackId: number;
	streamUrl: string;
	urls: string[];
	fileExtension: string;
	mimeType: string;
	codecs: string;
	segmented: boolean;
	audioMode: 'STEREO' | 'DOLBY_ATMOS';
	audioQuality: TrackAudioQuality;
	bitDepth?: number | null;
	sampleRate?: number | null;
	bitrateKbps?: number | null;
	trackReplayGain?: number | null;
}

/** Safe, public description of the bytes Syn will deliver to the player. */
export interface PlaybackDelivery {
	format: 'flac' | 'hi_res' | 'aac' | 'dolby';
	mimeType: string;
	lossless: boolean;
	/** Nominal bitrate for TIDAL's lossy tiers. Lossless FLAC is variable-rate. */
	nominalBitrateKbps: 96 | 320 | null;
}

const DOLBY_CODECS = new Set(['eac3', 'ac4']);

/**
 * Describe the source stream without changing its codec. In particular, AAC is
 * never wrapped or re-encoded as FLAC: that would not restore lost detail.
 */
export function describePlaybackDelivery(
	stream: Pick<ResolvedStreamInfo, 'audioQuality' | 'codecs' | 'mimeType'>
): PlaybackDelivery {
	if (stream.audioQuality === 'HI_RES_LOSSLESS') {
		return {
			format: 'hi_res',
			mimeType: stream.mimeType || 'audio/mp4',
			lossless: true,
			nominalBitrateKbps: null
		};
	}
	if (stream.codecs === 'flac') {
		return {
			format: 'flac',
			mimeType: stream.mimeType || 'audio/flac',
			lossless: true,
			nominalBitrateKbps: null
		};
	}
	if (DOLBY_CODECS.has(stream.codecs)) {
		return {
			format: 'dolby',
			mimeType: stream.mimeType || 'audio/mp4',
			lossless: false,
			nominalBitrateKbps: null
		};
	}
	return {
		format: 'aac',
		mimeType: stream.mimeType || 'audio/mp4',
		lossless: false,
		nominalBitrateKbps: stream.audioQuality === 'LOW' ? 96 : 320
	};
}

function readAttr(tag: string, name: string): string | undefined {
	const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
	return match ? match[1] : undefined;
}

function readNumAttr(tag: string, name: string): number | undefined {
	const raw = readAttr(tag, name);
	if (raw == null) return undefined;
	const value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
}

/**
 * Parse a TIDAL MPEG-DASH audio manifest into its ordered segment URLs.
 *
 * Translated from OrpheusDL-TIDAL `interface.py:parse_mpd` (a more complete
 * reference than tiddl's `parse_manifest_XML`, which drops the `initialization`
 * segment and ignores `startNumber`). Uses regex rather than an XML parser to
 * stay dependency-free — TIDAL's manifests are a single audio `Representation`.
 */
export function parseManifestXml(xmlContent: string): ParsedDashManifest {
	const repTag = xmlContent.match(/<Representation\b[^>]*>/i)?.[0] ?? '';
	const codecs = readAttr(repTag, 'codecs') ?? '';
	const bandwidth = readNumAttr(repTag, 'bandwidth');
	const sampleRateHz = readNumAttr(repTag, 'audioSamplingRate') ?? null;

	const segTag = xmlContent.match(/<SegmentTemplate\b[^>]*>/i)?.[0];
	const mediaTemplate = segTag ? readAttr(segTag, 'media') : undefined;
	if (!segTag || !mediaTemplate) {
		throw new TidalError('SegmentTemplate element with media attribute not found in DASH manifest');
	}

	const initUrl = readAttr(segTag, 'initialization') ?? null;
	const startNumber = readNumAttr(segTag, 'startNumber') ?? 1;

	const sTags = xmlContent.match(/<S\b[^>]*\/?>/gi);
	if (!sTags || sTags.length === 0) {
		throw new TidalError('SegmentTimeline S elements not found in DASH manifest');
	}

	let count = 0;
	for (const sTag of sTags) {
		count += 1;
		const repeat = readNumAttr(sTag, 'r');
		if (repeat && repeat > 0) count += repeat;
	}

	const mediaUrls: string[] = [];
	for (let i = 0; i < count; i++) {
		mediaUrls.push(mediaTemplate.replace(/\$Number\$/g, String(startNumber + i)));
	}

	return {
		initUrl,
		mediaUrls,
		codecs,
		bitrateKbps: bandwidth ? Math.round(bandwidth / 1000) : null,
		sampleRateHz
	};
}

/**
 * TIDAL reports how a BTS stream is protected. Syn proxies bytes as-is and has
 * no content-key handling, so anything other than "not encrypted" is not
 * playable through this pipeline and must not be presented as if it were.
 */
export function assertPlaintextManifest(encryptionType: string, trackId: string | number): void {
	const declared = (encryptionType ?? '').trim();
	if (declared === '' || declared.toUpperCase() === 'NONE') return;
	throw new TidalError(
		`Track ${trackId} is delivered with encryption Syn cannot decode (${declared}).`
	);
}

/**
 * Parses URLs, codecs, and file extension from a TIDAL track stream manifest.
 * Translates tiddl/core/utils/parse.py:parse_track_stream, extended to keep the
 * DASH init segment and precise MPD telemetry.
 */
export function parseTrackStream(stream: TrackStreamResponse): ParsedTrackStream {
	const decodedManifest = Buffer.from(stream.manifest, 'base64').toString('utf-8');

	let urls: string[];
	let codecs: string;
	let mimeType: string;
	let segmented = false;
	let bitrateKbps: number | null = null;
	let sampleRateHz: number | null = null;

	switch (stream.manifestMimeType) {
		case 'application/vnd.tidal.bts': {
			const parsed = JSON.parse(decodedManifest) as BTSManifest;
			// Syn has no decryptor: it proxies CDN bytes verbatim. Every manifest
			// seen so far reports `NONE`, but if TIDAL ever returns an encrypted
			// one, serving it would produce plausible-sized, unplayable audio and
			// surface as an opaque decode error. Fail loudly instead.
			assertPlaintextManifest(parsed.encryptionType, stream.trackId);
			urls = parsed.urls;
			codecs = parsed.codecs;
			mimeType = parsed.mimeType || (codecs === 'flac' ? 'audio/flac' : 'audio/mp4');
			break;
		}
		case 'application/dash+xml': {
			const parsed = parseManifestXml(decodedManifest);
			urls = parsed.initUrl ? [parsed.initUrl, ...parsed.mediaUrls] : [...parsed.mediaUrls];
			codecs = parsed.codecs;
			// A DASH stream is always fragmented MP4, even for the FLAC codec.
			mimeType = 'audio/mp4';
			segmented = urls.length > 1;
			bitrateKbps = parsed.bitrateKbps;
			sampleRateHz = parsed.sampleRateHz;
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

	return { urls, fileExtension, mimeType, codecs, segmented, bitrateKbps, sampleRateHz };
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

	// A safe read, and it sits directly in the playback hot path: without a retry
	// one transient 5xx from TIDAL fails the play outright.
	const response = await withTransientRetry(() =>
		f(url, {
			headers: {
				authorization: `Bearer ${token}`,
				accept: 'application/json'
			}
		})
	);

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
		segmented: parsed.segmented,
		audioMode: data.audioMode,
		audioQuality: data.audioQuality,
		bitDepth: data.bitDepth,
		sampleRate: data.sampleRate ?? parsed.sampleRateHz,
		bitrateKbps: parsed.bitrateKbps,
		trackReplayGain: data.trackReplayGain
	};
}

/**
 * Resolve a playable stream, walking **down** the quality ladder past "quality
 * not allowed in your subscription" responses so a HiRes request still lands on
 * `LOSSLESS`/`HIGH`/`LOW` for a lower-tier plan.
 *
 * @throws {TidalQualityDeniedError} when every tier is refused (no streaming plan)
 * @throws {TidalApiError | TidalPlaybackNotLinkedError | TidalAuthError} for other failures
 */
export async function resolveTrackStream(
	trackId: string | number,
	options: { quality?: TrackAudioQuality; ctx?: TidalRequestContext } = {}
): Promise<ResolvedStreamInfo> {
	const ladder = options.quality
		? [options.quality, ...QUALITY_LADDER.filter((q) => q !== options.quality)]
		: QUALITY_LADDER;

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
