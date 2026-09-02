import { describe, expect, it } from 'vitest';
import {
	normaliseAlbum,
	normaliseAlbumDetail,
	normaliseArtist,
	normaliseArtistDetail,
	normaliseCollectionPage,
	normaliseMixDetail,
	normalisePlaylist,
	normalisePlaylistDetail,
	normaliseSearchResults,
	normaliseTrack,
	normaliseTrackDetail
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

	it('keeps safe rich track and album metadata when supplied by TIDAL', () => {
		expect(
			normaliseTrack({
				id: 'track-rich',
				type: 'tracks',
				attributes: {
					title: 'Rich Track',
					duration: 245,
					trackNumber: 3,
					volumeNumber: 2,
					explicit: false,
					audioQuality: 'HI_RES',
					isrc: 'USABC1234567',
					popularity: 82,
					copyright: 'Example Records',
					imageUrl: 'https://resources.tidal.com/images/example/640x640.jpg'
				}
			})
		).toMatchObject({
			id: 'track-rich',
			duration: 245,
			trackNumber: 3,
			volumeNumber: 2,
			explicit: false,
			audioQuality: 'HI_RES',
			isrc: 'USABC1234567',
			popularity: 82,
			copyright: 'Example Records',
			imageUrl: 'https://resources.tidal.com/images/example/640x640.jpg'
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

	it('normalises a track detail compound document without exposing raw API fields', () => {
		expect(
			normaliseTrackDetail({
				data: {
					id: 'track-1',
					type: 'tracks',
					attributes: { title: 'Track One', duration: 'not exposed' },
					relationships: {
						artists: { data: [{ id: 'artist-1', type: 'artists' }] },
						albums: { data: [{ id: 'album-1', type: 'albums' }] }
					}
				},
				included: [artist, { id: 'album-1', type: 'albums', attributes: { title: 'Album One' } }]
			})
		).toEqual({
			kind: 'track',
			id: 'track-1',
			title: 'Track One',
			artists: [{ id: 'artist-1', name: 'Artist One' }],
			album: { id: 'album-1', title: 'Album One' }
		});
	});

	it('rejects malformed track detail documents', () => {
		expect(normaliseTrackDetail({ data: { id: 'album-1', type: 'albums' } })).toBeNull();
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

describe('normaliseCollectionPage', () => {
	it('resolves data linkages against included resources and reports more pages', () => {
		const page = normaliseCollectionPage({
			data: [
				{ id: 'album-1', type: 'albums' },
				{ id: 'artist-1', type: 'artists' }
			],
			included: [
				{
					id: 'album-1',
					type: 'albums',
					attributes: { title: 'Album One' },
					relationships: { artist: { data: [{ id: 'artist-1', type: 'artists' }] } }
				},
				artist
			],
			links: { next: '/userCollectionAlbums/me/relationships/items?page%5Bcursor%5D=abc' }
		});

		expect(page).toEqual({
			tracks: [],
			albums: [
				{
					kind: 'album',
					id: 'album-1',
					title: 'Album One',
					artists: [{ id: 'artist-1', name: 'Artist One' }]
				}
			],
			artists: [{ kind: 'artist', id: 'artist-1', name: 'Artist One' }],
			playlists: [],
			hasMore: true
		});
	});

	it('falls back to included resources and defaults hasMore to false', () => {
		const page = normaliseCollectionPage({
			data: [],
			included: [{ id: 'playlist-9', type: 'playlists', attributes: { name: 'Focus' } }]
		});

		expect(page.playlists).toEqual([{ kind: 'playlist', id: 'playlist-9', title: 'Focus' }]);
		expect(page.hasMore).toBe(false);
	});

	it('returns empty groups for a malformed document', () => {
		expect(normaliseCollectionPage(null)).toEqual({
			tracks: [],
			albums: [],
			artists: [],
			playlists: [],
			hasMore: false
		});
	});
});

describe('normaliseAlbumDetail', () => {
	it('normalises an album compound document and orders tracks correctly', () => {
		const doc = {
			data: {
				id: 'alb-1',
				type: 'albums',
				attributes: {
					title: 'Greatest Hits',
					releaseDate: '2023-01-01',
					audioQuality: 'HI_RES',
					copyright: '2023 Label Inc'
				},
				relationships: {
					artists: { data: [{ id: 'art-1', type: 'artists' }] },
					items: {
						data: [
							{ id: 'trk-2', type: 'tracks' },
							{ id: 'trk-1', type: 'tracks' }
						]
					}
				}
			},
			included: [
				{ id: 'art-1', type: 'artists', attributes: { name: 'Super Artist' } },
				{
					id: 'trk-1',
					type: 'tracks',
					attributes: { title: 'First Song', trackNumber: 1, duration: 180 }
				},
				{
					id: 'trk-2',
					type: 'tracks',
					attributes: { title: 'Second Song', trackNumber: 2, duration: 200 }
				}
			]
		};

		const detail = normaliseAlbumDetail(doc);
		expect(detail).not.toBeNull();
		expect(detail?.title).toBe('Greatest Hits');
		expect(detail?.audioQuality).toBe('HI_RES');
		expect(detail?.copyright).toBe('2023 Label Inc');
		expect(detail?.items).toHaveLength(2);
		expect(detail?.items[0].id).toBe('trk-1');
		expect(detail?.items[0].album?.id).toBe('alb-1');
		expect(detail?.items[1].id).toBe('trk-2');
		expect(detail?.duration).toBe(380);
		expect(detail?.numberOfItems).toBe(2);
	});

	it('returns null for non-album documents', () => {
		expect(normaliseAlbumDetail({ data: { id: 'trk-1', type: 'tracks' } })).toBeNull();
		expect(normaliseAlbumDetail(null)).toBeNull();
	});
});

describe('normaliseArtistDetail', () => {
	it('combines artist data with top tracks, albums, and similar artists', () => {
		const artistDoc = {
			data: {
				id: 'art-1',
				type: 'artists',
				attributes: { name: 'Main Artist', popularity: 95 }
			}
		};
		const tracksDoc = {
			data: [
				{
					id: 'trk-1',
					type: 'tracks',
					attributes: { title: 'Hit Track' }
				}
			]
		};
		const albumsDoc = {
			data: [
				{
					id: 'alb-1',
					type: 'albums',
					attributes: { title: 'Hit Album' }
				}
			]
		};
		const similarDoc = {
			data: [
				{
					id: 'art-2',
					type: 'artists',
					attributes: { name: 'Similar Band' }
				}
			]
		};

		const detail = normaliseArtistDetail(artistDoc, tracksDoc, albumsDoc, similarDoc);
		expect(detail).not.toBeNull();
		expect(detail?.name).toBe('Main Artist');
		expect(detail?.popularity).toBe(95);
		expect(detail?.topTracks).toHaveLength(1);
		expect(detail?.topTracks[0].title).toBe('Hit Track');
		expect(detail?.albums).toHaveLength(1);
		expect(detail?.albums[0].title).toBe('Hit Album');
		expect(detail?.similarArtists).toHaveLength(1);
		expect(detail?.similarArtists[0].name).toBe('Similar Band');
	});

	it('returns null for non-artist documents', () => {
		expect(normaliseArtistDetail(null)).toBeNull();
		expect(normaliseArtistDetail({ data: { id: 'alb-1', type: 'albums' } })).toBeNull();
	});
});

describe('normalisePlaylistDetail', () => {
	it('normalises playlist with items, creator, and description', () => {
		const doc = {
			data: {
				id: 'pl-1',
				type: 'playlists',
				attributes: {
					title: 'Chill Vibes',
					description: 'Relax and unwind'
				},
				relationships: {
					creator: { data: { id: 'usr-1', type: 'users' } },
					items: { data: [{ id: 'trk-1', type: 'tracks' }] }
				}
			},
			included: [
				{ id: 'usr-1', type: 'users', attributes: { name: 'Curator John' } },
				{ id: 'trk-1', type: 'tracks', attributes: { title: 'Chill Song', duration: 210 } }
			]
		};

		const detail = normalisePlaylistDetail(doc);
		expect(detail).not.toBeNull();
		expect(detail?.title).toBe('Chill Vibes');
		expect(detail?.description).toBe('Relax and unwind');
		expect(detail?.creator?.name).toBe('Curator John');
		expect(detail?.items).toHaveLength(1);
		expect(detail?.items[0].title).toBe('Chill Song');
		expect(detail?.duration).toBe(210);
		expect(detail?.numberOfItems).toBe(1);
	});
});

describe('normaliseMixDetail', () => {
	it('normalises a mix document with tracks', () => {
		const doc = {
			data: {
				id: 'mix-1',
				type: 'userDailyMixes',
				attributes: {
					title: 'Daily Mix 1',
					subtitle: 'Pop, Indie'
				},
				relationships: {
					items: { data: [{ id: 'trk-1', type: 'tracks' }] }
				}
			},
			included: [{ id: 'trk-1', type: 'tracks', attributes: { title: 'Mix Track' } }]
		};

		const detail = normaliseMixDetail(doc, 'daily');
		expect(detail).not.toBeNull();
		expect(detail?.title).toBe('Daily Mix 1');
		expect(detail?.subtitle).toBe('Pop, Indie');
		expect(detail?.mixType).toBe('daily');
		expect(detail?.items).toHaveLength(1);
	});
});
