/**
 * Server-only TIDAL integration. Import from `#lib/server/tidal` in `+server.ts`
 * / `+page.server.ts` / other server modules — never from client code.
 *
 * Typical use in a feature:
 *
 * ```ts
 * import { tidalJson } from '#lib/server/tidal';
 * export const load = async (event) => {
 *   const me = await tidalJson('/users/me', {}, { fetch: event.fetch });
 *   return { me };
 * };
 * ```
 */
export * from './errors';
export {
	getTidalConfig,
	resetTidalConfigCache,
	DEFAULT_SCOPES,
	WRITE_SCOPES,
	TIDAL_API_BASE,
	TIDAL_AUTHORIZE_URL,
	TIDAL_TOKEN_URL
} from './config';
export {
	getAccessToken,
	getPlaybackCountryCode,
	getPlaybackToken,
	tidalFetch,
	tidalJson,
	resetRefreshGuard,
	type TidalRequestContext
} from './client';
export {
	buildAuthorizeUrl,
	createPkcePair,
	createState,
	exchangeCode,
	refreshTokens,
	type PkcePair
} from './oauth';
export {
	readRecord,
	writeRecord,
	clearRecord,
	readPlaybackRecord,
	writePlaybackRecord,
	clearPlaybackRecord,
	dbTokenRowStore,
	createDbTokenRowStore,
	type TidalTokenRecord,
	type TokenRowStore,
	type TokenSlot
} from './store';
export { clearTokenCookie, readTokenCookie, writeTokenCookie, TIDAL_TOKEN_COOKIE } from './cookie';
export { seal, open } from './crypto';
export * as tidalApi from './api';
export * from './jsonapi';
export { getConnectionStatus, type TidalConnectionStatus } from './status';
export {
	fetchTrackStream,
	resolveTrackStream,
	parseTrackStream,
	parseManifestXml,
	isTrackUnavailableForPlayback,
	describePlaybackDelivery,
	QUALITY_LADDER,
	TidalQualityDeniedError,
	type TrackAudioQuality,
	type TrackStreamResponse,
	type BTSManifest,
	type ParsedDashManifest,
	type ParsedTrackStream,
	type ResolvedStreamInfo,
	type PlaybackDelivery
} from './stream';
export {
	withTransientRetry,
	TRANSIENT_READ_STATUSES,
	MAX_TRANSIENT_READ_RETRIES,
	type TransientRetryOptions
} from './retry';
export {
	resolveTrackStreamCached,
	invalidateStreamCache,
	__resetStreamCache,
	type ResolveTrackStreamCachedOptions
} from './stream-cache';
export {
	dbSegmentCacheIndex,
	SWEEP_BATCH_SIZE,
	type SegmentCacheIndex,
	type CachedObjectRecord
} from './segment-cache-index';
export {
	headSegmentedAudio,
	streamSegmentedAudio,
	__resetSegmentCache,
	__resetSweepThrottle
} from './segmented';
export {
	createTidalSegmentCache,
	tidalSegmentCache,
	type TidalSegmentCache,
	type TidalSegmentCacheConfig
} from './segment-cache-bucket';
export { getTrackCoverId, tidalArtworkUrl, resetArtworkCache } from './artwork';
export {
	markTrackUnplayable,
	getUnplayableTrackIds,
	filterPlayableTracks,
	__resetTrackPlayabilityCache
} from './track-playability';
export { getRequestedStreamQuality, type StreamingSettingsReader } from './playback';
export {
	requestDeviceAuthorization,
	pollDeviceToken,
	refreshDeviceToken,
	TIDAL_DEVICE_CLIENT_ID,
	TIDAL_DEVICE_SCOPE,
	type DeviceAuthorizationResponse,
	type DeviceTokenResult,
	type DeviceTokenSuccess,
	type DeviceTokenPending,
	type DeviceTokenExpired
} from './device-auth';
export {
	fetchTrackLyrics,
	parseLrc,
	type LyricCue,
	type TrackLyricsResponse,
	type ParsedTrackLyrics
} from './lyrics';
export {
	fetchAlbumReview,
	normalizeReviewText,
	type AlbumReview,
	type AlbumReviewRaw
} from './review';
export { generateM3u, sanitizeFileName, type GenerateM3uOptions } from './m3u';
export {
	parseTidalResource,
	VALID_RESOURCE_TYPES,
	type TidalResourceType,
	type ParsedTidalResource
} from '#lib/tidal/resource';
export { fetchUserFavorites, type UserFavorites, type UserFavoritesRaw } from './favorites';
export {
	fetchAlbumCredits,
	type AlbumCreditsResponse,
	type TrackCreditItem,
	type CreditEntry,
	type Contributor
} from './credits';
