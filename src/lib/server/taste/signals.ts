import type { AlbumSummary, ArtistSummary, TrackSummary } from '#lib/tidal/models';
import { tidalApi, type TidalRequestContext } from '#lib/server/tidal';
import { normaliseCollectionPage } from '#lib/server/tidal/normalise';

export type TasteSignalSource =
	'playlist' | 'followed_artist' | 'saved_track' | 'saved_album' | 'session';

export interface ArtistTasteSignal {
	artistId: string;
	source: TasteSignalSource;
	observedAt?: string;
}

export interface EraTasteSignal {
	decade: number;
	source: TasteSignalSource;
	observedAt?: string;
}

export interface TasteSignals {
	artistSignals: ArtistTasteSignal[];
	eraSignals: EraTasteSignal[];
}

export interface TasteSignalInput {
	followedArtists?: ArtistSummary[];
	playlistTracks?: TrackSummary[];
	savedTracks?: TrackSummary[];
	savedAlbums?: AlbumSummary[];
	sessionTracks?: TrackSummary[];
	observedAt?: string;
}

export interface TasteSignalReader {
	getFollowedArtists(ctx?: TidalRequestContext): Promise<ArtistSummary[]>;
	getSavedTracks?(ctx?: TidalRequestContext): Promise<TrackSummary[]>;
	getSavedAlbums?(ctx?: TidalRequestContext): Promise<AlbumSummary[]>;
	getPlaylists?(ctx?: TidalRequestContext): Promise<Array<{ id: string }>>;
	getPlaylistTracks?(playlistId: string, ctx?: TidalRequestContext): Promise<TrackSummary[]>;
}

const PROFILE_PLAYLIST_REQUEST_BUDGET = 16;

function normaliseCollection(document: { items: unknown[]; included: unknown[] }) {
	return normaliseCollectionPage({ data: document.items, included: document.included });
}

/**
 * The first live profile source. It is intentionally a small, injectable
 * adapter so the profile remains testable without a database or network.
 */
export const tidalTasteSignalReader: TasteSignalReader = {
	async getFollowedArtists(ctx) {
		const collection = await tidalApi.getFullCollection('artists', ctx);
		return normaliseCollection(collection).artists;
	},
	async getSavedTracks(ctx) {
		const collection = await tidalApi.getFullCollection('tracks', ctx, {
			include: ['artists', 'albums']
		});
		return normaliseCollection(collection).tracks;
	},
	async getSavedAlbums(ctx) {
		const collection = await tidalApi.getFullCollection('albums', ctx, { include: ['artists'] });
		return normaliseCollection(collection).albums;
	},
	async getPlaylists(ctx) {
		const collection = await tidalApi.getFullCollection('playlists', ctx);
		return normaliseCollection(collection).playlists.map(({ id }) => ({ id }));
	},
	async getPlaylistTracks(playlistId, ctx) {
		const collection = await tidalApi.getFullPlaylistItems(playlistId, ctx, {
			include: ['artists', 'albums']
		});
		return normaliseCollection(collection).tracks;
	}
};

function decadeFromReleaseDate(releaseDate: string | undefined): number | null {
	if (!releaseDate || !/^\d{4}/.test(releaseDate)) return null;
	const year = Number.parseInt(releaseDate.slice(0, 4), 10);
	return year >= 1880 && year <= 2100 ? Math.floor(year / 10) * 10 : null;
}

function addTrackSignals(
	target: TasteSignals,
	tracks: TrackSummary[] | undefined,
	source: TasteSignalSource,
	observedAt: string | undefined
): void {
	for (const track of tracks ?? []) {
		for (const artist of track.artists) {
			if (artist.id) target.artistSignals.push({ artistId: artist.id, source, observedAt });
		}
		const decade = decadeFromReleaseDate(track.album?.releaseDate);
		if (decade !== null) target.eraSignals.push({ decade, source, observedAt });
	}
}

/**
 * Reduces live TIDAL responses and bounded session state to the only facts the
 * profile needs. The display objects are intentionally discarded immediately;
 * titles, artwork, and track IDs never enter the derived profile.
 */
export function deriveTasteSignals(input: TasteSignalInput): TasteSignals {
	const signals: TasteSignals = { artistSignals: [], eraSignals: [] };
	const observedAt = input.observedAt;

	for (const artist of input.followedArtists ?? []) {
		if (artist.id)
			signals.artistSignals.push({ artistId: artist.id, source: 'followed_artist', observedAt });
	}
	addTrackSignals(signals, input.playlistTracks, 'playlist', observedAt);
	addTrackSignals(signals, input.savedTracks, 'saved_track', observedAt);
	addTrackSignals(signals, input.sessionTracks, 'session', observedAt);

	for (const album of input.savedAlbums ?? []) {
		for (const artist of album.artists) {
			if (artist.id) {
				signals.artistSignals.push({ artistId: artist.id, source: 'saved_album', observedAt });
			}
		}
		const decade = decadeFromReleaseDate(album.releaseDate);
		if (decade !== null) signals.eraSignals.push({ decade, source: 'saved_album', observedAt });
	}

	return signals;
}

/** Read the currently available live account signals without persisting their display metadata. */
export async function readTasteSignals(
	ctx: TidalRequestContext = {},
	reader: TasteSignalReader = tidalTasteSignalReader,
	now = new Date(),
	sessionTracks: TrackSummary[] = [],
	/** False once the background playlist analysis supplies playlist evidence. */
	includePlaylists = true
): Promise<TasteSignals> {
	const readOrEmpty = async <T>(read: (() => Promise<T>) | undefined, empty: T): Promise<T> => {
		if (!read) return empty;
		try {
			return await read();
		} catch {
			// A profile remains useful when one collection is temporarily unavailable.
			return empty;
		}
	};

	const [followedArtists, savedTracks, savedAlbums, playlists] = await Promise.all([
		readOrEmpty(() => reader.getFollowedArtists(ctx), [] as ArtistSummary[]),
		readOrEmpty(
			reader.getSavedTracks ? () => reader.getSavedTracks!(ctx) : undefined,
			[] as TrackSummary[]
		),
		readOrEmpty(
			reader.getSavedAlbums ? () => reader.getSavedAlbums!(ctx) : undefined,
			[] as AlbumSummary[]
		),
		readOrEmpty(
			includePlaylists && reader.getPlaylists ? () => reader.getPlaylists!(ctx) : undefined,
			[] as Array<{ id: string }>
		)
	]);

	const playlistTracks: TrackSummary[] = [];
	if (reader.getPlaylistTracks) {
		for (const playlist of playlists.slice(0, PROFILE_PLAYLIST_REQUEST_BUDGET)) {
			const tracks = await readOrEmpty(
				() => reader.getPlaylistTracks!(playlist.id, ctx),
				[] as TrackSummary[]
			);
			playlistTracks.push(...tracks);
		}
	}

	return deriveTasteSignals({
		followedArtists,
		playlistTracks,
		savedTracks,
		savedAlbums,
		sessionTracks,
		observedAt: now.toISOString()
	});
}
