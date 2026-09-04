import { createHash } from 'node:crypto';
import {
	BETTER_AUTH_SECRET,
	LASTFM_API_KEY,
	LASTFM_SHARED_SECRET,
	LASTFM_TOKEN_ENC_KEY,
	ORIGIN
} from '$app/env/private';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { lastfmConnection } from '#lib/server/db/schema';
import { open, seal } from '#lib/server/tidal/crypto';

const API_URL = 'https://ws.audioscrobbler.com/2.0/';
const MAX_SCROBBLE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface LastfmTrackInput {
	artist: string;
	track: string;
	album?: string;
	duration?: number;
	trackNumber?: number;
	playedAt?: number;
}

interface LastfmConnectionRecord {
	username: string;
	sessionKey: string;
	scrobbleEnabled: boolean;
	nowPlayingEnabled: boolean;
	lastScrobbledAt: Date | null;
}

export class LastfmError extends Error {
	constructor(
		message: string,
		readonly code?: number
	) {
		super(message);
	}
}

function config(): { apiKey: string; secret: string; encryptionKey: Buffer } {
	if (!LASTFM_API_KEY || !LASTFM_SHARED_SECRET) {
		throw new LastfmError('Last.fm is not configured.');
	}
	const encryptionKey = LASTFM_TOKEN_ENC_KEY
		? Buffer.from(LASTFM_TOKEN_ENC_KEY, 'base64')
		: createHash('sha256').update(BETTER_AUTH_SECRET).digest();
	if (encryptionKey.length !== 32) {
		throw new LastfmError('LASTFM_TOKEN_ENC_KEY must be a base64-encoded 32-byte value.');
	}
	return { apiKey: LASTFM_API_KEY, secret: LASTFM_SHARED_SECRET, encryptionKey };
}

export function isLastfmConfigured(): boolean {
	try {
		config();
		return true;
	} catch {
		return false;
	}
}

export function createLastfmSignature(params: Record<string, string>, secret: string): string {
	return createHash('md5')
		.update(
			Object.keys(params)
				.sort()
				.map((key) => `${key}${params[key]}`)
				.join('') + secret,
			'utf8'
		)
		.digest('hex');
}

async function signedPost<T>(method: string, params: Record<string, string>): Promise<T> {
	const { apiKey, secret } = config();
	const signed = { ...params, api_key: apiKey, method };
	const body = new URLSearchParams({
		...signed,
		api_sig: createLastfmSignature(signed, secret),
		format: 'json'
	});
	const response = await fetch(API_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	const payload = (await response.json().catch(() => null)) as
		{ error?: number; message?: string } | T | null;
	if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload)) {
		const error = payload as { error?: number; message?: string } | null;
		throw new LastfmError(error?.message ?? 'Last.fm request failed.', error?.error);
	}
	return payload as T;
}

function cleanText(value: unknown, name: string): string {
	if (typeof value !== 'string' || !value.trim()) throw new LastfmError(`${name} is required.`);
	return value.trim().slice(0, 500);
}

async function connectionForUser(userId: string): Promise<LastfmConnectionRecord | null> {
	const row = await db.query.lastfmConnection.findFirst({
		where: eq(lastfmConnection.userId, userId)
	});
	if (!row) return null;
	return row;
}

async function sessionKeyForUser(
	userId: string
): Promise<{ row: LastfmConnectionRecord; key: string } | null> {
	const row = await connectionForUser(userId);
	if (!row) return null;
	try {
		return { row, key: open(row.sessionKey, config().encryptionKey) };
	} catch {
		return null;
	}
}

export function buildLastfmAuthorizeUrl(): string {
	const { apiKey } = config();
	const url = new URL('https://www.last.fm/api/auth/');
	url.searchParams.set('api_key', apiKey);
	url.searchParams.set('cb', `${ORIGIN.replace(/\/$/, '')}/lastfm/callback`);
	return url.toString();
}

export async function exchangeLastfmToken(userId: string, token: string): Promise<void> {
	const response = await signedPost<{ session?: { name?: string; key?: string } }>(
		'auth.getSession',
		{
			token: cleanText(token, 'Authorization token')
		}
	);
	const username = response.session?.name?.trim();
	const sessionKey = response.session?.key;
	if (!username || !sessionKey) throw new LastfmError('Last.fm returned an invalid session.');
	const encrypted = seal(sessionKey, config().encryptionKey);
	await db
		.insert(lastfmConnection)
		.values({ userId, username, sessionKey: encrypted, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: lastfmConnection.userId,
			set: { username, sessionKey: encrypted, updatedAt: new Date() }
		});
}

export async function getLastfmConnection(userId: string) {
	const row = await connectionForUser(userId);
	return {
		configured: isLastfmConfigured(),
		connected: Boolean(row),
		username: row?.username ?? null,
		scrobbleEnabled: row?.scrobbleEnabled ?? false,
		nowPlayingEnabled: row?.nowPlayingEnabled ?? false,
		lastScrobbledAt: row?.lastScrobbledAt?.toISOString() ?? null
	};
}

export async function disconnectLastfm(userId: string): Promise<void> {
	await db.delete(lastfmConnection).where(eq(lastfmConnection.userId, userId));
}

export async function reportNowPlaying(userId: string, input: LastfmTrackInput): Promise<void> {
	const connected = await sessionKeyForUser(userId);
	if (!connected?.row.nowPlayingEnabled) return;
	const artist = cleanText(input.artist, 'Artist');
	const track = cleanText(input.track, 'Track');
	const params: Record<string, string> = { artist, track, sk: connected.key };
	if (input.album?.trim()) params.album = input.album.trim().slice(0, 500);
	if (input.duration && input.duration > 0) params.duration = String(Math.floor(input.duration));
	if (input.trackNumber && input.trackNumber > 0)
		params.trackNumber = String(Math.floor(input.trackNumber));
	try {
		await signedPost('track.updateNowPlaying', params);
	} catch {
		// Last.fm explicitly recommends that stale now-playing requests are not retried.
	}
}

export async function scrobble(userId: string, input: LastfmTrackInput): Promise<void> {
	const connected = await sessionKeyForUser(userId);
	if (!connected?.row.scrobbleEnabled) return;
	const artist = cleanText(input.artist, 'Artist');
	const track = cleanText(input.track, 'Track');
	const playedAt = Number(input.playedAt);
	if (
		!Number.isFinite(playedAt) ||
		playedAt < Date.now() - MAX_SCROBBLE_AGE_MS ||
		playedAt > Date.now() + 120_000
	) {
		throw new LastfmError('The scrobble timestamp is invalid.');
	}
	const params: Record<string, string> = {
		artist,
		track,
		timestamp: String(Math.floor(playedAt / 1000)),
		sk: connected.key
	};
	if (input.album?.trim()) params.album = input.album.trim().slice(0, 500);
	if (input.duration && input.duration > 0) params.duration = String(Math.floor(input.duration));
	if (input.trackNumber && input.trackNumber > 0)
		params.trackNumber = String(Math.floor(input.trackNumber));
	await signedPost('track.scrobble', params);
	await db
		.update(lastfmConnection)
		.set({ lastScrobbledAt: new Date(), updatedAt: new Date() })
		.where(eq(lastfmConnection.userId, userId));
}
