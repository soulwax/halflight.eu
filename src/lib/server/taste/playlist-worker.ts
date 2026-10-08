import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { tastePlaylistAnalysis } from '#lib/server/db/schema';
import { log } from '#lib/server/log';
import { getListeningPreferences } from '#lib/server/listening-preferences';
import { createImportFetch } from '#lib/server/playlists/import-fetch';
import { tidalApi, type TidalRequestContext } from '#lib/server/tidal';
import { TidalApiError, TidalAuthError, TidalNotConnectedError } from '#lib/server/tidal/errors';
import type { Resource } from '#lib/server/tidal/jsonapi';
import { createDbTokenRowStore } from '#lib/server/tidal/store';
import {
	MAX_ITEMS_PER_PLAYLIST,
	MAX_PLAYLIST_FAILURES,
	RELIST_INTERVAL_MS,
	applyListing,
	digestPlaylist,
	emptyAnalysisState,
	isListingDue,
	parseAnalysisState,
	stepSpacing,
	type PlaylistAnalysisState,
	type PlaylistItemFacts
} from './playlist-analysis';

export interface PlaylistAnalysisSource {
	listPlaylists(): Promise<{ id: string; version: string }[]>;
	readItems(playlistId: string): Promise<PlaylistItemFacts[]>;
}

type Linkage = { id: string; type: string; meta?: { addedAt?: string } };

function attributes(resource: Resource | undefined): Record<string, unknown> {
	return (resource?.attributes ?? {}) as Record<string, unknown>;
}

function linkageIds(resource: Resource | undefined, relationship: string): string[] {
	const data = (resource?.relationships as Record<string, { data?: unknown }> | undefined)?.[
		relationship
	]?.data;
	const list = Array.isArray(data) ? data : data ? [data] : [];
	return list
		.map((entry) => (entry as { id?: unknown }).id)
		.filter((id): id is string => typeof id === 'string');
}

function cursorOf(next: string | undefined): string | undefined {
	if (!next) return undefined;
	try {
		return (
			new URL(next, 'https://openapi.tidal.com/v2/').searchParams.get('page[cursor]') ?? undefined
		);
	} catch {
		return undefined;
	}
}

/**
 * Reads through the import fetch lanes, so the worker shares TIDAL's pacing and
 * rate-limit cooldowns with imports instead of competing with them.
 */
export function tidalPlaylistSource(userId: string): PlaylistAnalysisSource {
	const ctx: TidalRequestContext = {
		store: createDbTokenRowStore(userId),
		fetch: createImportFetch((...args) => fetch(...args))
	};
	return {
		async listPlaylists() {
			const collection = await tidalApi.getFullCollection('playlists', ctx);
			const byId = new Map(
				collection.included
					.filter((resource) => resource.type === 'playlists')
					.map((resource) => [resource.id, resource])
			);
			return collection.items
				.filter((item) => item.type === 'playlists')
				.map((item) => {
					const attrs = attributes(byId.get(item.id) ?? item);
					return {
						id: item.id,
						version: `${attrs.lastModifiedAt ?? ''}|${attrs.numberOfItems ?? ''}`
					};
				});
		},
		async readItems(playlistId) {
			const facts: PlaylistItemFacts[] = [];
			let cursor: string | undefined;
			do {
				const page = await tidalApi.getPlaylistItems(
					playlistId,
					{ include: ['artists', 'albums'], cursor },
					ctx
				);
				const included = new Map(
					(page.included ?? []).map((resource) => [`${resource.type}:${resource.id}`, resource])
				);
				for (const item of (page.data ?? []) as Linkage[]) {
					if (item.type !== 'tracks') continue;
					const track = included.get(`tracks:${item.id}`);
					const albumId = linkageIds(track, 'albums')[0];
					const album = albumId ? included.get(`albums:${albumId}`) : undefined;
					const releaseDate = attributes(album).releaseDate;
					facts.push({
						artistIds: linkageIds(track, 'artists'),
						...(typeof releaseDate === 'string' ? { releaseDate } : {}),
						...(item.meta?.addedAt ? { addedAt: item.meta.addedAt } : {})
					});
				}
				cursor = cursorOf(page.links?.next);
			} while (cursor && facts.length < MAX_ITEMS_PER_PLAYLIST);
			return facts.slice(0, MAX_ITEMS_PER_PLAYLIST);
		}
	};
}

export interface StepResult {
	state: PlaylistAnalysisState;
	delayMs: number;
	/** A pass finished and changed the evidence: rebuild the profile. */
	rebuild: boolean;
}

/** Provider problems that say "not now", as opposed to "not this playlist". */
function isAccountWide(cause: unknown): boolean {
	return (
		cause instanceof TidalAuthError ||
		cause instanceof TidalNotConnectedError ||
		(cause instanceof TidalApiError && (cause.status === 429 || cause.status >= 500))
	);
}

/**
 * Do one unit of work: either re-list the playlists or analyse one playlist.
 * Work is spread out by the caller using `delayMs`, never done in a burst.
 */
export async function runAnalysisStep(
	current: PlaylistAnalysisState,
	source: PlaylistAnalysisSource,
	now = new Date()
): Promise<StepResult> {
	let state = current;
	if (isListingDue(state, now)) {
		const before = Object.keys(state.playlists).length;
		state = applyListing(state, await source.listPlaylists(), now);
		if (state.pending.length) return { state, delayMs: stepSpacing(state), rebuild: false };
		const removed = Object.keys(state.playlists).length !== before;
		const firstCompletion = !state.firstPassCompletedAt;
		if (firstCompletion) state = { ...state, firstPassCompletedAt: now.toISOString() };
		return { state, delayMs: RELIST_INTERVAL_MS, rebuild: removed || firstCompletion };
	}

	const [playlistId, ...rest] = state.pending;
	if (!playlistId) {
		const listed = state.listedAt ? Date.parse(state.listedAt) : now.getTime();
		return {
			state,
			delayMs: Math.max(60_000, listed + RELIST_INTERVAL_MS - now.getTime()),
			rebuild: false
		};
	}

	try {
		const items = await source.readItems(playlistId);
		const digest = digestPlaylist(items, state.known[playlistId] ?? '', now);
		const { [playlistId]: _cleared, ...failures } = state.failures;
		state = {
			...state,
			pending: rest,
			failures,
			playlists: { ...state.playlists, [playlistId]: digest }
		};
	} catch (cause) {
		if (isAccountWide(cause)) throw cause;
		const attempts = (state.failures[playlistId] ?? 0) + 1;
		state = {
			...state,
			// Retry later in the pass; give up on this version after a few attempts.
			pending: attempts >= MAX_PLAYLIST_FAILURES ? rest : [...rest, playlistId],
			failures: { ...state.failures, [playlistId]: attempts }
		};
	}

	if (state.pending.length) return { state, delayMs: stepSpacing(state), rebuild: false };
	state = { ...state, firstPassCompletedAt: state.firstPassCompletedAt ?? now.toISOString() };
	return { state, delayMs: RELIST_INTERVAL_MS, rebuild: true };
}

/** Back off per account when TIDAL says "not now". */
export function backoffFor(cause: unknown): number {
	if (cause instanceof TidalAuthError || cause instanceof TidalNotConnectedError)
		return 12 * 60 * 60_000;
	if (cause instanceof TidalApiError && cause.status === 429) return 15 * 60_000;
	return 30 * 60_000;
}

// ─── Persistence and scheduling ────────────────────────────────────────────

const LEASE_MS = 10 * 60_000;
const TICK_MS = 30_000;
const ENROL_INTERVAL_MS = 10 * 60_000;

export async function readPlaylistAnalysis(userId: string): Promise<PlaylistAnalysisState> {
	try {
		const [row] = await db
			.select({ data: tastePlaylistAnalysis.data })
			.from(tastePlaylistAnalysis)
			.where(eq(tastePlaylistAnalysis.userId, userId))
			.limit(1);
		return parseAnalysisState(row?.data);
	} catch {
		return emptyAnalysisState();
	}
}

/**
 * Let the worker act on a changed preference within a tick or two: an opt-out
 * clears the stored analysis and rebuilds the profile without it.
 */
export async function schedulePlaylistAnalysisSoon(userId: string): Promise<void> {
	await db
		.update(tastePlaylistAnalysis)
		.set({ nextRunAt: new Date() })
		.where(eq(tastePlaylistAnalysis.userId, userId))
		.catch(() => {});
}

/** Every listener with a TIDAL connection gets a row, first runs staggered over ten minutes. */
async function enrolListeners(): Promise<void> {
	await db.execute(sql`
		insert into taste_playlist_analysis (user_id, data, next_run_at)
		select user_id, ${JSON.stringify(emptyAnalysisState())}::jsonb,
			now() + (random() * interval '10 minutes')
		from tidal_auth where secret is not null
		on conflict (user_id) do nothing
	`);
}

/** Lease the single most overdue listener; other processes skip leased rows. */
async function claimDue(): Promise<{ userId: string; state: PlaylistAnalysisState } | null> {
	const rows = await db.execute<{ user_id: string; data: unknown }>(sql`
		update taste_playlist_analysis
		set lease_until = now() + ${`${LEASE_MS / 1000} seconds`}::interval
		where user_id = (
			select user_id from taste_playlist_analysis
			where next_run_at <= now() and (lease_until is null or lease_until < now())
			order by next_run_at
			limit 1
			for update skip locked
		)
		returning user_id, data
	`);
	const row = rows[0];
	return row ? { userId: row.user_id, state: parseAnalysisState(row.data) } : null;
}

async function release(userId: string, state: PlaylistAnalysisState, delayMs: number) {
	await db
		.update(tastePlaylistAnalysis)
		.set({
			data: state,
			nextRunAt: new Date(Date.now() + delayMs),
			leaseUntil: null,
			updatedAt: new Date()
		})
		.where(eq(tastePlaylistAnalysis.userId, userId));
}

export interface WorkerDependencies {
	source: (userId: string) => PlaylistAnalysisSource;
	rebuildProfile: (userId: string) => Promise<void>;
}

/** Claim one due listener and run exactly one step for them. */
export async function runWorkerTick(deps: WorkerDependencies): Promise<boolean> {
	const claimed = await claimDue();
	if (!claimed) return false;
	const { userId, state } = claimed;
	try {
		if (!(await getListeningPreferences(userId)).learnFromPlaylists) {
			// Opted out: forget the playlist evidence and drop it from the profile.
			const hadEvidence = Object.keys(state.playlists).length > 0;
			await release(userId, emptyAnalysisState(), RELIST_INTERVAL_MS);
			if (hadEvidence) await deps.rebuildProfile(userId);
			return true;
		}
		const step = await runAnalysisStep(state, deps.source(userId));
		await release(userId, step.state, step.delayMs);
		if (step.rebuild) await deps.rebuildProfile(userId);
	} catch (cause) {
		log.warn('taste playlist analysis step deferred', {
			cause: cause instanceof Error ? cause.name : 'UnknownError',
			...(cause instanceof TidalApiError ? { upstreamStatus: cause.status } : {})
		});
		await release(userId, state, backoffFor(cause)).catch(() => {});
	}
	return true;
}

const WORKER_KEY = Symbol.for('halflight.tastePlaylistWorker');
type WorkerHandle = { stop: () => void };

/**
 * Start the in-process worker once per process. One step per tick across all
 * listeners keeps it cheap; the per-listener spacing keeps first passes slow.
 */
export function startPlaylistAnalysisWorker(
	deps: WorkerDependencies,
	tickMs = TICK_MS
): WorkerHandle {
	const registry = globalThis as typeof globalThis & { [WORKER_KEY]?: WorkerHandle };
	if (registry[WORKER_KEY]) return registry[WORKER_KEY];
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lastEnrol = 0;
	const tick = async () => {
		try {
			if (Date.now() - lastEnrol >= ENROL_INTERVAL_MS) {
				lastEnrol = Date.now();
				await enrolListeners();
			}
			await runWorkerTick(deps);
		} catch (cause) {
			log.warn('taste playlist worker tick failed', {
				cause: cause instanceof Error ? cause.name : 'UnknownError'
			});
		} finally {
			if (!stopped) timer = setTimeout(tick, tickMs);
		}
	};
	timer = setTimeout(tick, tickMs);
	const handle = {
		stop() {
			stopped = true;
			clearTimeout(timer);
			delete registry[WORKER_KEY];
		}
	};
	registry[WORKER_KEY] = handle;
	return handle;
}
