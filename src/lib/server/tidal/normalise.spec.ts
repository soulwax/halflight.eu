import { describe, expect, it } from 'vitest';
import {
	normaliseAlbum,
	normaliseArtist,
	normalisePlaylist,
	normaliseSearchResults,
	normaliseTrack
} from './normalise';

const artist = { id: 'artist-1', type: 'artists', attributes: { name: 'Artist One' } };

describe('TIDAL display normalisers', () => {
	it('normalises a track and resolves artist linkage from included resources', () => {
		const track = {
			id: 'track-1',
			type: 'tracks',
			attributes: { title: 'Track One' },
			relationships: {
				contributors: { data: [{ id: 'artist-1', type: 'artists' }] },
				release: { data: { id: 'album-1', type: 'albums' } }
			}
		};
		const included = new Map<string, unknown>([
			['artists:artist-1', artist],
			['albums:album-1', { id: 'album-1', type: 'albums', attributes: { title: 'Album One' } }]
		]);

		expect(normaliseTrack(track, included)).toEqual({
			kind: 'track',
			id: 'track-1',
			title: 'Track One',
			artists: [{ id: 'artist-1', name: 'Artist One' }],
			album: { id: 'album-1', title: 'Album One' }
		});
	});

	it('preserves title and name metadata exactly, with an id fallback for missing attributes', () => {
		expect(
			normaliseArtist({ id: 'artist-2', type: 'artists', attributes: { title: 'MiXeD Case' } })
		).toEqual({
			kind: 'artist',
			id: 'artist-2',
			name: 'MiXeD Case'
		});
		expect(normalisePlaylist({ id: 'playlist-1', type: 'playlists', attributes: {} })).toEqual({
			kind: 'playlist',
			id: 'playlist-1',
			title: 'playlist-1'
		});
	});

	it('normalises album artist relationships and leaves unresolved linkages usable', () => {
		const album = {
			id: 'album-1',
			type: 'albums',
			attributes: { name: 'Album One' },
			relationships: { artist: { data: { id: 'artist-2', type: 'artists' } } }
		};

		expect(normaliseAlbum(album)).toEqual({
			kind: 'album',
			id: 'album-1',
			title: 'Album One',
			artists: [{ id: 'artist-2', name: 'artist-2' }]
		});
	});

	it('rejects malformed or mismatched resources instead of throwing', () => {
		expect(normaliseTrack({ id: 'album-1', type: 'albums' })).toBeNull();
		expect(normaliseTrack({ id: 1, type: 'tracks' })).toBeNull();
		expect(normaliseArtist(null)).toBeNull();
	});
});

describe('normaliseSearchResults', () => {
	it('groups media linked from a search container and de-duplicates resources', () => {
		const document = {
			data: {
				id: 'search-1',
				type: 'searchResults',
				relationships: {
					tracks: { data: [{ id: 'track-1', type: 'tracks' }] },
					artists: { data: [{ id: 'artist-1', type: 'artists' }] }
				}
			},
			included: [
				{
					id: 'track-1',
					type: 'tracks',
					attributes: { title: 'Track One' },
					relationships: { performers: { data: [{ id: 'artist-1', type: 'artists' }] } }
				},
				artist
			]
		};

		expect(normaliseSearchResults(document)).toEqual({
			tracks: [
				{
					kind: 'track',
					id: 'track-1',
					title: 'Track One',
					artists: [{ id: 'artist-1', name: 'Artist One' }]
				}
			],
			albums: [],
			artists: [{ kind: 'artist', id: 'artist-1', name: 'Artist One' }],
			playlists: []
		});
	});

	it('uses included supported resources when a response has no usable result linkage', () => {
		expect(
			normaliseSearchResults({
				data: { id: 'search-2', type: 'searchResults' },
				included: [
					{ id: 'album-2', type: 'albums', attributes: { title: 'Album Two' } },
					{ id: 'playlist-2', type: 'playlists', attributes: { name: 'Playlist Two' } },
					{ id: 'ignored', type: 'videos', attributes: { title: 'Ignored' } }
				]
			})
		).toEqual({
			tracks: [],
			albums: [{ kind: 'album', id: 'album-2', title: 'Album Two', artists: [] }],
			artists: [],
			playlists: [{ kind: 'playlist', id: 'playlist-2', title: 'Playlist Two' }]
		});
	});

	it('returns empty groups for malformed documents', () => {
		expect(normaliseSearchResults({ data: [{ id: 1, type: 'tracks' }] })).toEqual({
			tracks: [],
			albums: [],
			artists: [],
			playlists: []
		});
	});
});
