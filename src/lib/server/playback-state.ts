import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { db } from '#lib/server/db';
import { playbackOperationResult, playbackState } from '#lib/server/db/schema';
import { log } from '#lib/server/log';
import {
	createQueueEntry,
	isQueueEntryId,
	toDisplayTrack,
	type QueueEntry
} from '#lib/player/queue-entry.js';
import type { AlbumReference, ArtistReference, TrackSummary } from '#lib/tidal/models';

export const MAX_PLAYBACK_QUEUE_LENGTH = 100;
export const MAX_PLAYBACK_HISTORY_LENGTH = 50;
const MAX_POSITION_SECONDS = 60 * 60 * 24;
const MAX_PLAYBACK_OPERATION_RESULTS = 50;
const PLAYBACK_OPERATION_RESULT_RETENTION_MS = 24 * 60 * 60 * 1_000;
export const PLAYBACK_DEVICE_LEASE_MS = 45_000;
export const PLAYBACK_STATE_ORIGINS = ['listening-room', 'halflight-now'] as const;

export type PlaybackStateOrigin = (typeof PLAYBACK_STATE_ORIGINS)[number];

const entryIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128));
const queueCommandSchema = v.union([
	v.object({ type: v.literal('append'), entries: v.array(v.unknown()) }),
	v.object({ type: v.literal('prepend'), entry: v.unknown() }),
	v.object({ type: v.literal('remove'), entryId: entryIdSchema }),
	v.object({
		type: v.literal('move'),
		entryId: entryIdSchema,
		beforeEntryId: v.optional(entryIdSchema),
		afterEntryId: v.optional(entryIdSchema)
	}),
	v.object({ type: v.literal('clear') }),
	v.object({ type: v.literal('replace'), entries: v.array(v.unknown()) })
]);

/**
 * Compatible wire contract for the existing snapshot endpoint. Queue commands
 * are still client-side reconciliation intent; the server validates them now
 * so a future named-intent endpoint can adopt the field without accepting an
 * unrecognised command from an old or forged client.
 */
const playbackStateSnapshotSchema = v.object({
	currentTrack: v.nullable(v.unknown()),
	queue: v.array(v.unknown()),
	history: v.array(v.unknown()),
	currentTime: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(MAX_POSITION_SECONDS)),
	queueCommands: v.optional(v.array(queueCommandSchema))
});

const playbackStateOriginSchema = v.picklist(PLAYBACK_STATE_ORIGINS);
const playbackStateRevisionSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const playbackDeviceIdSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(16),
	v.maxLength(128),
	v.regex(/^device_[a-zA-Z0-9_-]+$/)
);

export interface PlaybackDeviceStatus {
	origin: PlaybackStateOrigin;
	expiresAt: string;
	/** True only for the browser identity that owns the current lease. */
	isCurrent: boolean;
}

export interface PlaybackState {
	currentTrack: TrackSummary | null;
	queue: QueueEntry[];
	history: TrackSummary[];
	currentTime: number;
	revision: number;
	lastOrigin: PlaybackStateOrigin | null;
	activeDevice: PlaybackDeviceStatus | null;
}

export type PlaybackStateInput = Omit<PlaybackState, 'revision' | 'lastOrigin' | 'activeDevice'>;

export const EMPTY_PLAYBACK_STATE: PlaybackState = {
	currentTrack: null,
	queue: [],
	history: [],
	currentTime: 0,
	revision: 0,
	lastOrigin: null,
	activeDevice: null
};

export interface PlaybackStateStore {
	read(userId: string, deviceId?: string | null): Promise<PlaybackState | null>;
	write(
		userId: string,
		state: PlaybackStateInput,
		expectedRevision: number,
		origin: PlaybackStateOrigin,
		deviceId?: string | null
	): Promise<PlaybackState | null>;
}

export interface PlaybackDeviceLeaseStore {
	claim(userId: string, deviceId: string, origin: PlaybackStateOrigin): Promise<PlaybackState>;
}

export interface PlaybackStateSaveResult {
	state: PlaybackState;
	conflict: boolean;
}

export type QueueIntent =
	| { type: 'queue.append'; entries: QueueEntry[] }
	| { type: 'queue.prepend'; entry: QueueEntry }
	| { type: 'queue.remove'; entryId: string }
	| { type: 'queue.move'; entryId: string; beforeEntryId?: string; afterEntryId?: string }
	| { type: 'queue.clear' }
	| { type: 'queue.replace'; entries: QueueEntry[] };

export interface PlaybackIntent {
	version: 2;
	expectedRevision: number;
	operationId: string;
	origin: PlaybackStateOrigin;
	deviceId?: string;
	intent: QueueIntent;
}

export interface PlaybackIntentResult extends PlaybackStateSaveResult {
	/** The response was recovered from a previous accepted operation. */
	duplicate: boolean;
	/** The intent was well-formed but cannot apply to the current queue. */
	invalid?: boolean;
}

export interface PlaybackIntentStore {
	apply(userId: string, intent: PlaybackIntent): Promise<PlaybackIntentResult>;
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

/**
 * Validate one queued occurrence, preserving a client-supplied `entryId` when it
 * is safe and minting one otherwise, so legacy rows written before the entry-id
 * protocol still resume with stable, independently addressable entries.
 */
export function parseQueueEntry(value: unknown): QueueEntry | null {
	const track = parsePlaybackTrack(value);
	if (!track) return null;
	const record = asRecord(value);
	const entryId = record && isQueueEntryId(record.entryId) ? record.entryId : undefined;
	return createQueueEntry(track, entryId);
}

function parseQueueEntryList(value: unknown, maximum: number): QueueEntry[] | null {
	if (!Array.isArray(value)) return null;
	return value
		.map(parseQueueEntry)
		.filter((entry): entry is QueueEntry => entry !== null)
		.slice(0, maximum);
}

/** Parse the only playback-state shape accepted by the API. */
export function parsePlaybackState(value: unknown): PlaybackStateInput | null {
	const parsed = v.safeParse(playbackStateSnapshotSchema, value);
	if (!parsed.success) return null;
	const state = parsed.output;
	const currentTrack = state.currentTrack === null ? null : parsePlaybackTrack(state.currentTrack);
	if (state.currentTrack !== null && !currentTrack) return null;
	const queue = parseQueueEntryList(state.queue, MAX_PLAYBACK_QUEUE_LENGTH);
	const history = parseTrackList(state.history, MAX_PLAYBACK_HISTORY_LENGTH);
	if (!queue || !history) return null;
	return { currentTrack, queue, history, currentTime: state.currentTime };
}

/** Only explicitly named product surfaces may claim a playback-state write. */
export function parsePlaybackStateOrigin(value: unknown): PlaybackStateOrigin | null {
	const parsed = v.safeParse(playbackStateOriginSchema, value);
	return parsed.success ? parsed.output : null;
}

/** Client revisions start at zero and advance only in the database. */
export function parsePlaybackStateRevision(value: unknown): number | null {
	const parsed = v.safeParse(playbackStateRevisionSchema, value);
	return parsed.success ? parsed.output : null;
}

/** An opaque per-browser ID, never an account or provider identifier. */
export function parsePlaybackDeviceId(value: unknown): string | null {
	const parsed = v.safeParse(playbackDeviceIdSchema, value);
	return parsed.success ? parsed.output : null;
}

function parseRequiredQueueEntry(value: unknown): QueueEntry | null {
	const record = asRecord(value);
	if (!record || !isQueueEntryId(record.entryId)) return null;
	const track = parsePlaybackTrack(record);
	return track ? createQueueEntry(track, record.entryId) : null;
}

function parseRequiredQueueEntries(value: unknown): QueueEntry[] | null {
	if (!Array.isArray(value)) return null;
	const entries = value.map(parseRequiredQueueEntry);
	if (entries.some((entry) => entry === null)) return null;
	const queueEntries = entries as QueueEntry[];
	if (new Set(queueEntries.map((entry) => entry.entryId)).size !== queueEntries.length) return null;
	return queueEntries.slice(0, MAX_PLAYBACK_QUEUE_LENGTH);
}

/** Parse a versioned, idempotent queue mutation. */
export function parsePlaybackIntent(value: unknown): PlaybackIntent | null {
	const body = asRecord(value);
	if (!body || body.version !== 2 || !isQueueEntryId(body.operationId)) return null;
	const expectedRevision = parsePlaybackStateRevision(body.expectedRevision);
	const origin = parsePlaybackStateOrigin(body.origin);
	const deviceId = body.deviceId == null ? undefined : parsePlaybackDeviceId(body.deviceId);
	const rawIntent = asRecord(body.intent);
	if (
		expectedRevision === null ||
		!origin ||
		(body.deviceId != null && !deviceId) ||
		!rawIntent ||
		typeof rawIntent.type !== 'string'
	)
		return null;

	let intent: QueueIntent | null = null;
	switch (rawIntent.type) {
		case 'queue.append': {
			const entries = parseRequiredQueueEntries(rawIntent.entries);
			intent = entries ? { type: rawIntent.type, entries } : null;
			break;
		}
		case 'queue.prepend': {
			const entry = parseRequiredQueueEntry(rawIntent.entry);
			intent = entry ? { type: rawIntent.type, entry } : null;
			break;
		}
		case 'queue.remove':
			intent = isQueueEntryId(rawIntent.entryId)
				? { type: rawIntent.type, entryId: rawIntent.entryId }
				: null;
			break;
		case 'queue.move':
			intent =
				isQueueEntryId(rawIntent.entryId) &&
				(rawIntent.beforeEntryId == null || isQueueEntryId(rawIntent.beforeEntryId)) &&
				(rawIntent.afterEntryId == null || isQueueEntryId(rawIntent.afterEntryId))
					? {
							type: rawIntent.type,
							entryId: rawIntent.entryId,
							...(rawIntent.beforeEntryId ? { beforeEntryId: rawIntent.beforeEntryId } : {}),
							...(rawIntent.afterEntryId ? { afterEntryId: rawIntent.afterEntryId } : {})
						}
					: null;
			break;
		case 'queue.clear':
			intent = { type: rawIntent.type };
			break;
		case 'queue.replace': {
			const entries = parseRequiredQueueEntries(rawIntent.entries);
			intent = entries ? { type: rawIntent.type, entries } : null;
			break;
		}
	}

	return intent
		? {
				version: 2,
				expectedRevision,
				operationId: body.operationId,
				origin,
				...(deviceId ? { deviceId } : {}),
				intent
			}
		: null;
}

/** Apply a validated queue intent without mutating the authoritative queue. */
export function applyQueueIntent(queue: QueueEntry[], intent: QueueIntent): QueueEntry[] | null {
	const next = queue.slice();
	const existingIds = new Set(next.map((entry) => entry.entryId));
	const addEntries = (entries: QueueEntry[], at: 'start' | 'end') => {
		if (entries.some((entry) => existingIds.has(entry.entryId))) return false;
		if (at === 'start') next.unshift(...entries);
		else next.push(...entries);
		return true;
	};

	switch (intent.type) {
		case 'queue.append':
			if (!addEntries(intent.entries, 'end')) return null;
			break;
		case 'queue.prepend':
			if (!addEntries([intent.entry], 'start')) return null;
			break;
		case 'queue.remove': {
			const index = next.findIndex((entry) => entry.entryId === intent.entryId);
			if (index === -1) return null;
			next.splice(index, 1);
			break;
		}
		case 'queue.move': {
			const index = next.findIndex((entry) => entry.entryId === intent.entryId);
			if (index === -1) return null;
			const [entry] = next.splice(index, 1);
			if (!entry) return null;
			if (intent.beforeEntryId) {
				const before = next.findIndex((item) => item.entryId === intent.beforeEntryId);
				if (before === -1) return null;
				next.splice(before, 0, entry);
			} else if (intent.afterEntryId) {
				const after = next.findIndex((item) => item.entryId === intent.afterEntryId);
				if (after === -1) return null;
				next.splice(after + 1, 0, entry);
			} else {
				next.push(entry);
			}
			break;
		}
		case 'queue.clear':
			return [];
		case 'queue.replace':
			return intent.entries.slice(0, MAX_PLAYBACK_QUEUE_LENGTH);
	}

	return next.slice(0, MAX_PLAYBACK_QUEUE_LENGTH);
}

/**
 * Identify the *content* of an intent for idempotency, deliberately excluding
 * `operationId` (already the lookup key — hashing it too would be redundant)
 * and `expectedRevision`.
 *
 * `expectedRevision` is transient: `session-coordinator.ts` sends the
 * client's current revision on every attempt, including a retry of an
 * already-applied operation after a lost response, once the client has
 * rebased onto a newer revision it learned about in the meantime. Hashing it
 * made that legitimate retry look like a different request: `apply()` finds
 * a stored `playbackOperationResult` row for this `operationId` (proof the
 * operation already succeeded once), but its `requestFingerprint` no longer
 * matches, so the dedup check just below does not fire — and *any* stored
 * row for this `operationId`, matching or not, short-circuits straight to
 * `invalid: true`, a permanent `400` the client cannot recover by retrying.
 * `intent.operationId` is minted once per logical command and only ever
 * reused for a retry of that same command, so two requests sharing one
 * operationId are always meant to be recognised as the same request.
 */
export function playbackIntentFingerprint(intent: PlaybackIntent): string {
	return createHash('sha256')
		.update(
			JSON.stringify({
				origin: intent.origin,
				deviceId: intent.deviceId ?? null,
				intent: intent.intent
			})
		)
		.digest('hex');
}

function parseJson(value: string | null): unknown {
	if (!value) return null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function fromRow(
	row: {
		currentTrackJson: string | null;
		queueJson: string;
		queueEntriesJson?: string;
		historyJson: string;
		currentTime: number;
		revision: number;
		lastOrigin: string | null;
		activeDeviceId?: string | null;
		activeDeviceOrigin?: string | null;
		activeDeviceExpiresAt?: Date | null;
	},
	deviceId?: string | null
): PlaybackState {
	const activeOrigin = parsePlaybackStateOrigin(row.activeDeviceOrigin);
	const activeExpiresAt = row.activeDeviceExpiresAt;
	const hasActiveDevice =
		Boolean(row.activeDeviceId) &&
		Boolean(activeOrigin) &&
		activeExpiresAt instanceof Date &&
		activeExpiresAt.getTime() > Date.now();
	const entryQueue = parseJson(row.queueEntriesJson ?? null);
	const input = parsePlaybackState({
		currentTrack: parseJson(row.currentTrackJson),
		queue:
			Array.isArray(entryQueue) && entryQueue.length > 0 ? entryQueue : parseJson(row.queueJson),
		history: parseJson(row.historyJson),
		currentTime: row.currentTime
	});
	return input
		? {
				...input,
				revision: Math.max(0, row.revision),
				lastOrigin: parsePlaybackStateOrigin(row.lastOrigin),
				activeDevice: hasActiveDevice
					? {
							origin: activeOrigin!,
							expiresAt: activeExpiresAt!.toISOString(),
							isCurrent: row.activeDeviceId === deviceId
						}
					: null
			}
		: EMPTY_PLAYBACK_STATE;
}

const playbackStateSelection = {
	currentTrackJson: playbackState.currentTrackJson,
	queueJson: playbackState.queueJson,
	queueEntriesJson: playbackState.queueEntriesJson,
	historyJson: playbackState.historyJson,
	currentTime: playbackState.currentTime,
	revision: playbackState.revision,
	lastOrigin: playbackState.lastOrigin,
	activeDeviceId: playbackState.activeDeviceId,
	activeDeviceOrigin: playbackState.activeDeviceOrigin,
	activeDeviceExpiresAt: playbackState.activeDeviceExpiresAt
};

export const dbPlaybackStateStore: PlaybackStateStore = {
	async read(userId, deviceId) {
		const rows = await db
			.select(playbackStateSelection)
			.from(playbackState)
			.where(eq(playbackState.userId, userId))
			.limit(1);
		return rows[0] ? fromRow(rows[0], deviceId) : null;
	},
	async write(userId, state, expectedRevision, origin, deviceId) {
		const leaseExpiresAt = new Date(Date.now() + PLAYBACK_DEVICE_LEASE_MS);
		const writingDeviceId = deviceId ?? '';
		const values = {
			currentTrackJson: state.currentTrack ? JSON.stringify(state.currentTrack) : null,
			queueJson: JSON.stringify(state.queue.map(toDisplayTrack)),
			queueEntriesJson: JSON.stringify(state.queue),
			historyJson: JSON.stringify(state.history),
			currentTime: state.currentTime,
			lastOrigin: origin,
			updatedAt: new Date()
		};
		const preserveActivePlayback = sql`coalesce(
			${playbackState.activeDeviceId} is not null
			and ${playbackState.activeDeviceId} <> ${writingDeviceId}
			and ${playbackState.activeDeviceExpiresAt} > now(),
			false
		)`;
		const rows = await db
			.insert(playbackState)
			.values({ userId, ...values, revision: expectedRevision + 1 })
			.onConflictDoUpdate({
				target: playbackState.userId,
				set: {
					...values,
					// Queue edits from another device are welcome, but only the owner
					// of the live lease may move the shared resume point.
					currentTrackJson: sql`case when ${preserveActivePlayback} then ${playbackState.currentTrackJson} else ${values.currentTrackJson} end`,
					historyJson: sql`case when ${preserveActivePlayback} then ${playbackState.historyJson} else ${values.historyJson} end`,
					currentTime: sql`case when ${preserveActivePlayback} then ${playbackState.currentTime} else ${values.currentTime} end`,
					activeDeviceExpiresAt: sql`case when ${playbackState.activeDeviceId} = ${writingDeviceId} then ${leaseExpiresAt} else ${playbackState.activeDeviceExpiresAt} end`,
					revision: sql`${playbackState.revision} + 1`
				},
				setWhere: sql`${playbackState.revision} = ${expectedRevision}`
			})
			.returning(playbackStateSelection);
		return rows[0] ? fromRow(rows[0], deviceId) : null;
	}
};

/** Deliberately claim the canonical resume point for one browser device. */
export const dbPlaybackDeviceLeaseStore: PlaybackDeviceLeaseStore = {
	async claim(userId, deviceId, origin) {
		const now = new Date();
		const rows = await db
			.insert(playbackState)
			.values({
				userId,
				revision: 1,
				lastOrigin: origin,
				activeDeviceId: deviceId,
				activeDeviceOrigin: origin,
				activeDeviceExpiresAt: new Date(now.getTime() + PLAYBACK_DEVICE_LEASE_MS),
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: playbackState.userId,
				set: {
					activeDeviceId: deviceId,
					activeDeviceOrigin: origin,
					activeDeviceExpiresAt: new Date(now.getTime() + PLAYBACK_DEVICE_LEASE_MS),
					lastOrigin: origin,
					updatedAt: now,
					revision: sql`${playbackState.revision} + 1`
				}
			})
			.returning(playbackStateSelection);
		return fromRow(rows[0]!, deviceId);
	}
};

function parseStoredPlaybackState(value: unknown): PlaybackState | null {
	const record = asRecord(value);
	if (!record) return null;
	const input = parsePlaybackState(record);
	const revision = parsePlaybackStateRevision(record.revision);
	if (!input || revision === null) return null;
	return {
		...input,
		revision,
		lastOrigin: record.lastOrigin == null ? null : parsePlaybackStateOrigin(record.lastOrigin),
		activeDevice: null
	};
}

export const dbPlaybackIntentStore: PlaybackIntentStore = {
	async apply(userId, intent) {
		const fingerprint = playbackIntentFingerprint(intent);
		return db.transaction(async (tx) => {
			const operationRows = await tx
				.select({
					requestFingerprint: playbackOperationResult.requestFingerprint,
					resultJson: playbackOperationResult.resultJson
				})
				.from(playbackOperationResult)
				.where(
					and(
						eq(playbackOperationResult.userId, userId),
						eq(playbackOperationResult.operationId, intent.operationId)
					)
				)
				.limit(1);
			const operation = operationRows[0];
			if (operation && operation.requestFingerprint === fingerprint) {
				const state = parseStoredPlaybackState(parseJson(operation.resultJson));
				if (state) return { state, conflict: false, duplicate: true };
			}

			const stateRows = await tx
				.select(playbackStateSelection)
				.from(playbackState)
				.where(eq(playbackState.userId, userId))
				.limit(1);
			const current = stateRows[0] ? fromRow(stateRows[0], intent.deviceId) : EMPTY_PLAYBACK_STATE;

			if (operation) {
				return { state: current, conflict: true, duplicate: false, invalid: true };
			}
			if (current.revision !== intent.expectedRevision) {
				return { state: current, conflict: true, duplicate: false };
			}

			const queue = applyQueueIntent(current.queue, intent.intent);
			if (!queue) return { state: current, conflict: false, duplicate: false, invalid: true };

			const now = new Date();
			const values = {
				currentTrackJson: current.currentTrack ? JSON.stringify(current.currentTrack) : null,
				queueJson: JSON.stringify(queue.map(toDisplayTrack)),
				queueEntriesJson: JSON.stringify(queue),
				historyJson: JSON.stringify(current.history),
				currentTime: current.currentTime,
				lastOrigin: intent.origin,
				updatedAt: now
			};
			const savedRows = await tx
				.insert(playbackState)
				.values({ userId, ...values, revision: intent.expectedRevision + 1 })
				.onConflictDoUpdate({
					target: playbackState.userId,
					set: { ...values, revision: sql`${playbackState.revision} + 1` },
					setWhere: sql`${playbackState.revision} = ${intent.expectedRevision}`
				})
				.returning(playbackStateSelection);
			const saved = savedRows[0] ? fromRow(savedRows[0], intent.deviceId) : null;
			if (!saved) {
				const concurrentOperations = await tx
					.select({
						requestFingerprint: playbackOperationResult.requestFingerprint,
						resultJson: playbackOperationResult.resultJson
					})
					.from(playbackOperationResult)
					.where(
						and(
							eq(playbackOperationResult.userId, userId),
							eq(playbackOperationResult.operationId, intent.operationId)
						)
					)
					.limit(1);
				const concurrent = concurrentOperations[0];
				if (concurrent?.requestFingerprint === fingerprint) {
					const recovered = parseStoredPlaybackState(parseJson(concurrent.resultJson));
					if (recovered) return { state: recovered, conflict: false, duplicate: true };
				}
				const latestRows = await tx
					.select(playbackStateSelection)
					.from(playbackState)
					.where(eq(playbackState.userId, userId))
					.limit(1);
				return {
					state: latestRows[0] ? fromRow(latestRows[0], intent.deviceId) : EMPTY_PLAYBACK_STATE,
					conflict: true,
					duplicate: false
				};
			}

			await tx.insert(playbackOperationResult).values({
				userId,
				operationId: intent.operationId,
				requestFingerprint: fingerprint,
				resultJson: JSON.stringify(saved)
			});

			const expiry = new Date(now.getTime() - PLAYBACK_OPERATION_RESULT_RETENTION_MS);
			await tx
				.delete(playbackOperationResult)
				.where(
					and(
						eq(playbackOperationResult.userId, userId),
						lt(playbackOperationResult.createdAt, expiry)
					)
				);
			const overflow = await tx
				.select({ operationId: playbackOperationResult.operationId })
				.from(playbackOperationResult)
				.where(eq(playbackOperationResult.userId, userId))
				.orderBy(desc(playbackOperationResult.createdAt))
				.offset(MAX_PLAYBACK_OPERATION_RESULTS);
			if (overflow.length > 0) {
				await tx.delete(playbackOperationResult).where(
					and(
						eq(playbackOperationResult.userId, userId),
						inArray(
							playbackOperationResult.operationId,
							overflow.map((row) => row.operationId)
						)
					)
				);
			}

			return { state: saved, conflict: false, duplicate: false };
		});
	}
};

export async function getPlaybackState(
	userId: string,
	store: PlaybackStateStore = dbPlaybackStateStore,
	deviceId?: string | null
): Promise<PlaybackState> {
	// Loaded on every app-shell render — a storage failure falls back to an
	// empty state rather than 500-ing the page.
	try {
		return (await store.read(userId, deviceId)) ?? EMPTY_PLAYBACK_STATE;
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
	store: PlaybackStateStore = dbPlaybackStateStore,
	deviceId?: string | null
): Promise<PlaybackStateSaveResult> {
	return store.write(userId, state, expectedRevision, origin, deviceId).then(async (saved) => {
		if (saved) return { state: saved, conflict: false };
		return { state: (await store.read(userId, deviceId)) ?? EMPTY_PLAYBACK_STATE, conflict: true };
	});
}

/**
 * Take the short-lived active-playback lease after an explicit owner gesture.
 * It is deliberately separate from route loading: merely opening another site
 * can observe a session but cannot seize it or start audio.
 */
export function claimPlaybackDevice(
	userId: string,
	deviceId: string,
	origin: PlaybackStateOrigin,
	store: PlaybackDeviceLeaseStore = dbPlaybackDeviceLeaseStore
): Promise<PlaybackState> {
	return store.claim(userId, deviceId, origin);
}

/** Apply an entry-targeted, replay-safe queue operation. */
export function applyPlaybackIntent(
	userId: string,
	intent: PlaybackIntent,
	store: PlaybackIntentStore = dbPlaybackIntentStore
): Promise<PlaybackIntentResult> {
	return store.apply(userId, intent);
}
