import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { playbackState } from '#lib/server/db/schema';
import { log } from '#lib/server/log';
import type { AlbumReference, ArtistReference, TrackSummary } from '#lib/tidal/models';

export const MAX_PLAYBACK_QUEUE_LENGTH = 100;
export const MAX_PLAYBACK_HISTORY_LENGTH = 50;
const MAX_POSITION_SECONDS = 60 * 60 * 24;
export const PLAYBACK_STATE_ORIGINS = ['listening-room', 'halflight-now'] as const;

export type PlaybackStateOrigin = (typeof PLAYBACK_STATE_ORIGINS)[number];

export interface PlaybackState {
	currentTrack: TrackSummary | null;
	queue: TrackSummary[];
	history: TrackSummary[];
	currentTime: number;
	revision: number;
	lastOrigin: PlaybackStateOrigin | null;
}

export type PlaybackStateInput = Omit<PlaybackState, 'revision' | 'lastOrigin'>;

export const EMPTY_PLAYBACK_STATE: PlaybackState = {
	currentTrack: null,
	queue: [],
	history: [],
	currentTime: 0,
	revision: 0,
	lastOrigin: null
};

export interface PlaybackStateStore {
	read(userId: string): Promise<PlaybackState | null>;
	write(
		userId: string,
		state: PlaybackStateInput,
		expectedRevision: number,
		origin: PlaybackStateOrigin
	): Promise<PlaybackState | null>;
}

export interface PlaybackStateSaveResult {
	state: PlaybackState;
	conflict: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function requiredText(value: unknown, maxLength: number): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text && text.length <= maxLength ? text : null;
}

function optionalText(value: unknown, maxLength: number): string | undefined {
	if (value == null) return undefined;
	return requiredText(value, maxLength) ?? undefined;
}

function optionalInteger(value: unknown, max: number): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
		? value
		: undefined;
}

function parseArtist(value: unknown): ArtistReference | null {
	const artist = asRecord(value);
	const id = requiredText(artist?.id, 128);
	const name = requiredText(artist?.name, 256);
	return id && name ? { id, name } : null;
}

function parseAlbum(value: unknown): AlbumReference | undefined {
	if (value == null) return undefined;
	const album = asRecord(value);
	const id = requiredText(album?.id, 128);
	const title = requiredText(album?.title, 512);
	if (!album || !id || !title) return undefined;
	return {
		id,
		title,
		imageUrl: optionalText(album.imageUrl, 2_048),
		releaseDate: optionalText(album.releaseDate, 32)
	};
}

/** Validate and trim an untrusted client track before it reaches PostgreSQL. */
export function parsePlaybackTrack(value: unknown): TrackSummary | null {
	const track = asRecord(value);
	if (!track || track.kind !== 'track') return null;
	const id = requiredText(track.id, 128);
	const title = requiredText(track.title, 512);
	if (!id || !title || !Array.isArray(track.artists)) return null;

	// Drop artist entries that do not validate rather than rejecting the track —
	// TIDAL search / mix results occasionally omit an artist id.
	const artists = track.artists
		.map(parseArtist)
		.filter((artist): artist is ArtistReference => Boolean(artist))
		.slice(0, 20);
	if (artists.length === 0) return null;

	const album = parseAlbum(track.album);
	const duration = optionalInteger(track.duration, MAX_POSITION_SECONDS);
	const trackNumber = optionalInteger(track.trackNumber, 10_000);
	const volumeNumber = optionalInteger(track.volumeNumber, 10_000);
	const popularity = optionalInteger(track.popularity, 100);
	const result: TrackSummary = {
		kind: 'track',
		id,
		title,
		artists,
		...(album ? { album } : {}),
		...(duration == null ? {} : { duration }),
		...(trackNumber == null ? {} : { trackNumber }),
		...(volumeNumber == null ? {} : { volumeNumber }),
		...(typeof track.explicit === 'boolean' ? { explicit: track.explicit } : {}),
		...(optionalText(track.audioQuality, 64)
			? { audioQuality: optionalText(track.audioQuality, 64) }
			: {}),
		...(optionalText(track.isrc, 64) ? { isrc: optionalText(track.isrc, 64) } : {}),
		...(popularity == null ? {} : { popularity }),
		...(optionalText(track.copyright, 1_000)
			? { copyright: optionalText(track.copyright, 1_000) }
			: {}),
		...(optionalText(track.imageUrl, 2_048)
			? { imageUrl: optionalText(track.imageUrl, 2_048) }
			: {})
	};
	return result;
}

function parseTrackList(value: unknown, maximum: number): TrackSummary[] | null {
	if (!Array.isArray(value)) return null;
	// Keep whatever validates, capped at the limit — one odd entry must not
	// throw away the whole resume queue.
	return value
		.map(parsePlaybackTrack)
		.filter((track): track is TrackSummary => track !== null)
		.slice(0, maximum);
}

/** Parse the only playback-state shape accepted by the API. */
export function parsePlaybackState(value: unknown): PlaybackStateInput | null {
	const state = asRecord(value);
	if (!state) return null;
	const currentTrack = state.currentTrack === null ? null : parsePlaybackTrack(state.currentTrack);
	if (state.currentTrack !== null && !currentTrack) return null;
	const queue = parseTrackList(state.queue, MAX_PLAYBACK_QUEUE_LENGTH);
	const history = parseTrackList(state.history, MAX_PLAYBACK_HISTORY_LENGTH);
	const currentTime = optionalInteger(state.currentTime, MAX_POSITION_SECONDS);
	if (!queue || !history || currentTime == null) return null;
	return { currentTrack, queue, history, currentTime };
}

/** Only explicitly named product surfaces may claim a playback-state write. */
export function parsePlaybackStateOrigin(value: unknown): PlaybackStateOrigin | null {
	return typeof value === 'string' && PLAYBACK_STATE_ORIGINS.includes(value as PlaybackStateOrigin)
		? (value as PlaybackStateOrigin)
		: null;
}

/** Client revisions start at zero and advance only in the database. */
export function parsePlaybackStateRevision(value: unknown): number | null {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function parseJson(value: string | null): unknown {
	if (!value) return null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function fromRow(row: {
	currentTrackJson: string | null;
	queueJson: string;
	historyJson: string;
	currentTime: number;
	revision: number;
	lastOrigin: string | null;
}): PlaybackState {
	const input = parsePlaybackState({
		currentTrack: parseJson(row.currentTrackJson),
		queue: parseJson(row.queueJson),
		history: parseJson(row.historyJson),
		currentTime: row.currentTime
	});
	return input
		? {
				...input,
				revision: Math.max(0, row.revision),
				lastOrigin: parsePlaybackStateOrigin(row.lastOrigin)
			}
		: EMPTY_PLAYBACK_STATE;
}

export const dbPlaybackStateStore: PlaybackStateStore = {
	async read(userId) {
		const rows = await db
			.select({
				currentTrackJson: playbackState.currentTrackJson,
				queueJson: playbackState.queueJson,
				historyJson: playbackState.historyJson,
				currentTime: playbackState.currentTime,
				revision: playbackState.revision,
				lastOrigin: playbackState.lastOrigin
			})
			.from(playbackState)
			.where(eq(playbackState.userId, userId))
			.limit(1);
		return rows[0] ? fromRow(rows[0]) : null;
	},
	async write(userId, state, expectedRevision, origin) {
		const values = {
			currentTrackJson: state.currentTrack ? JSON.stringify(state.currentTrack) : null,
			queueJson: JSON.stringify(state.queue),
			historyJson: JSON.stringify(state.history),
			currentTime: state.currentTime,
			lastOrigin: origin,
			updatedAt: new Date()
		};
		const rows = await db
			.insert(playbackState)
			.values({ userId, ...values, revision: expectedRevision + 1 })
			.onConflictDoUpdate({
				target: playbackState.userId,
				set: { ...values, revision: sql`${playbackState.revision} + 1` },
				setWhere: sql`${playbackState.revision} = ${expectedRevision}`
			})
			.returning({
				currentTrackJson: playbackState.currentTrackJson,
				queueJson: playbackState.queueJson,
				historyJson: playbackState.historyJson,
				currentTime: playbackState.currentTime,
				revision: playbackState.revision,
				lastOrigin: playbackState.lastOrigin
			});
		return rows[0] ? fromRow(rows[0]) : null;
	}
};

export async function getPlaybackState(
	userId: string,
	store: PlaybackStateStore = dbPlaybackStateStore
): Promise<PlaybackState> {
	// Loaded on every app-shell render — a storage failure falls back to an
	// empty state rather than 500-ing the page.
	try {
		return (await store.read(userId)) ?? EMPTY_PLAYBACK_STATE;
	} catch (err) {
		log.error('playback-state read failed, using empty state', { cause: err });
		return EMPTY_PLAYBACK_STATE;
	}
}

export function savePlaybackState(
	userId: string,
	state: PlaybackStateInput,
	expectedRevision: number,
	origin: PlaybackStateOrigin,
	store: PlaybackStateStore = dbPlaybackStateStore
): Promise<PlaybackStateSaveResult> {
	return store.write(userId, state, expectedRevision, origin).then(async (saved) => {
		if (saved) return { state: saved, conflict: false };
		return { state: (await store.read(userId)) ?? EMPTY_PLAYBACK_STATE, conflict: true };
	});
}
