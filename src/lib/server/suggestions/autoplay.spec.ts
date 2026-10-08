import { describe, expect, it, vi } from 'vitest';
import type { TrackSummary } from '#lib/tidal/models';
import { baseTitle, recordingKeys, suggestAutoplayTracks, type AutoplaySources } from './autoplay';

let nextId = 100;
function track(
	title: string,
	artist: string,
	extra: Partial<TrackSummary> & { artistId?: string } = {}
): TrackSummary {
	const { artistId, ...rest } = extra;
	return {
		kind: 'track',
		id: String(nextId++),
		title,
		artists: [{ id: artistId ?? `a-${artist}`, name: artist }],
		...rest
	};
}

function sources(radio: Record<string, TrackSummary[]>): AutoplaySources {
	return {
		radio: vi.fn(async (id: string) => {
			if (!radio[id]) throw new Error('radio unavailable');
			return radio[id];
		}),
		playable: vi.fn(async (tracks: TrackSummary[]) => tracks)
	};
}

const seed = { id: '1', title: 'Seed', artist: 'Seed Artist' };

describe('autoplay suggestions', () => {
	it('returns the configured number of songs from the seed radio', async () => {
		const radio = Array.from({ length: 30 }, (_, i) => track(`Song ${i}`, `Artist ${i}`));
		const result = await suggestAutoplayTracks(
			{ seeds: [seed], exclude: [], count: 10 },
			sources({ '1': radio })
		);
		expect(result).toHaveLength(10);
		expect(result.map((t) => t.title)).toEqual(radio.slice(0, 10).map((t) => t.title));
	});

	it('never repeats what is queued, playing or recently heard — by ID, ISRC or song', async () => {
		const sameId = track('Different title', 'X');
		const sameIsrc = track('Renamed', 'Y', { isrc: 'GBAYE0601498' });
		const remaster = track('Known Song (Remastered 2011)', 'Known Artist');
		const fresh = track('Fresh', 'Z');
		const result = await suggestAutoplayTracks(
			{
				seeds: [seed],
				exclude: [
					{ id: sameId.id },
					{ id: '9', isrc: 'GB-AYE-06-01498' },
					{ id: '8', title: 'Known Song', artist: 'Known Artist' }
				],
				count: 10
			},
			sources({ '1': [sameId, sameIsrc, remaster, fresh] })
		);
		expect(result.map((t) => t.title)).toEqual(['Fresh']);
	});

	it('deduplicates the same recording appearing under several seeds', async () => {
		const shared = track('Shared', 'S', { isrc: 'USRC17607839' });
		const copy = { ...track('Shared', 'S'), isrc: 'USRC17607839' };
		const result = await suggestAutoplayTracks(
			{ seeds: [seed, { id: '2' }], exclude: [], count: 10 },
			sources({ '1': [shared], '2': [copy, track('Other', 'O')] })
		);
		expect(result.map((t) => t.title)).toEqual(['Shared', 'Other']);
	});

	it('follows the whole recent session by interleaving seed radios', async () => {
		const result = await suggestAutoplayTracks(
			{ seeds: [seed, { id: '2' }], exclude: [], count: 4 },
			sources({
				'1': [track('A1', 'a1'), track('A2', 'a2')],
				'2': [track('B1', 'b1'), track('B2', 'b2')]
			})
		);
		expect(result.map((t) => t.title)).toEqual(['A1', 'B1', 'A2', 'B2']);
	});

	it('lets an artist return but not dominate a batch', async () => {
		const radio = [
			...Array.from({ length: 5 }, (_, i) => track(`Same ${i}`, 'Prolific')),
			track('Else', 'Someone')
		];
		const result = await suggestAutoplayTracks(
			{ seeds: [seed], exclude: [], count: 10 },
			sources({ '1': radio })
		);
		expect(result.filter((t) => t.artists[0].name === 'Prolific')).toHaveLength(2);
		expect(result.map((t) => t.title)).toContain('Else');
	});

	it('keeps going when one seed has no radio', async () => {
		const result = await suggestAutoplayTracks(
			{ seeds: [{ id: 'gone' }, seed], exclude: [], count: 10 },
			sources({ '1': [track('Survivor', 'S')] })
		);
		expect(result.map((t) => t.title)).toEqual(['Survivor']);
	});

	it('drops recordings already known to be unplayable', async () => {
		const dead = track('Dead', 'D');
		const live = track('Live', 'L');
		const source = sources({ '1': [dead, live] });
		source.playable = vi.fn(async (tracks: TrackSummary[]) => tracks.filter((t) => t !== dead));
		const result = await suggestAutoplayTracks({ seeds: [seed], exclude: [], count: 10 }, source);
		expect(result).toEqual([live]);
	});

	describe('with a taste profile', () => {
		const profile = {
			artists: { 'a-loved': 1 },
			exclusions: { artists: ['a-banned'], eras: [1980] },
			overrides: { artists: { 'a-pinned': 'pinned' as const, 'a-muted': 'dampened' as const } }
		};

		it('removes excluded artists and eras', async () => {
			const result = await suggestAutoplayTracks(
				{ seeds: [seed], exclude: [], count: 10, profile },
				sources({
					'1': [
						track('Banned', 'banned'),
						track('Eighties', 'e', { album: { id: 'x', title: 'X', releaseDate: '1984-05-01' } }),
						track('Kept', 'k')
					]
				})
			);
			expect(result.map((t) => t.title)).toEqual(['Kept']);
		});

		it('moves loved and pinned artists up and dampened ones down within radio order', async () => {
			// Ten radio slots: taste shifts a song by roughly half the list, not to the top outright.
			const filler = Array.from({ length: 6 }, (_, i) => track(`Filler ${i}`, `filler-${i}`));
			const result = await suggestAutoplayTracks(
				{ seeds: [seed], exclude: [], count: 10, profile },
				sources({
					'1': [
						track('Neutral', 'neutral'),
						track('Muted', 'muted'),
						track('Loved', 'loved'),
						...filler.slice(0, 3),
						track('Pinned', 'pinned'),
						...filler.slice(3)
					]
				})
			);
			const order = result.map((t) => t.title);
			expect(order.indexOf('Loved')).toBeLessThan(order.indexOf('Neutral'));
			expect(order.indexOf('Pinned')).toBeLessThan(order.indexOf('Filler 0'));
			expect(order.indexOf('Muted')).toBeGreaterThan(order.indexOf('Filler 2'));
		});
	});
});

describe('recording identity', () => {
	it('ignores edition noise in titles', () => {
		expect(baseTitle('Heroes (2017 Remaster)')).toBe('heroes');
		expect(baseTitle('Heroes - Single Version')).toBe('heroes');
		expect(baseTitle('Heroes feat. Someone')).toBe('heroes');
	});

	it('keys a recording by ID, normalised ISRC and artist plus title', () => {
		expect(
			recordingKeys({ id: '7', title: 'Song', artist: 'Bänd', isrc: 'us-rc1-76-07839' })
		).toEqual(['id:7', 'isrc:USRC17607839', 'song:band|song']);
	});
});
