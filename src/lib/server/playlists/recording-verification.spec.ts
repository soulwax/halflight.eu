import { describe, expect, it, vi } from 'vitest';
import {
	findVerifiedReplacements,
	recordingMatchScore,
	verifyImportedRecordings
} from './recording-verification';
import type { TrackSummary } from '#lib/tidal/models';
const source: TrackSummary = {
	kind: 'track',
	id: '18343352',
	title: 'Moan (Trentemoeller Remix)',
	isrc: 'DEL020620082',
	duration: 445,
	explicit: false,
	artists: [{ id: '3503559', name: 'Trentemøller' }]
};
const exact: TrackSummary = { ...source, id: '230824923', title: 'Moan (Trentemøller Remix)' };
const best: TrackSummary = { ...exact, id: '300', isrc: 'DEL020620099' };
const document = (tracks: TrackSummary[]) => ({
	data: tracks.map(({ id, ...attributes }) => ({ id, type: 'tracks', attributes }))
});
function dependencies(tracks = [best, exact]) {
	return {
		search: vi.fn().mockResolvedValue(document(tracks)),
		validate: vi.fn(async (items: TrackSummary[]) =>
			items.filter((track) => track.id !== source.id)
		)
	};
}
describe('replacement verification', () => {
	it('prefers exact recording identity and tolerates provider spelling differences', () => {
		expect(recordingMatchScore(source, exact)).toBe(100);
		expect(recordingMatchScore(source, best)).toBe(90);
	});
	it.each([
		{ ...best, title: 'Moan (Radio Edit)' },
		{ ...best, artists: [{ id: 'other', name: 'Another artist' }] },
		{ ...best, duration: 210 },
		{ ...best, explicit: true }
	])('rejects a different version, artist, duration or clean/explicit edition', (candidate) => {
		expect(recordingMatchScore(source, candidate)).toBe(0);
	});
	it('offers only playable candidates and ranks exact matches first', async () => {
		const deps = dependencies();
		const result = await findVerifiedReplacements(source, 'owner', {}, 'HIGH', deps);
		expect(result.map(({ track, match }) => [track.id, match])).toEqual([
			[exact.id, 'isrc'],
			[best.id, 'best_fit']
		]);
		expect(deps.validate).toHaveBeenCalledWith([exact], 'owner', {}, 'HIGH', true);
	});
	it('relinks repeated source occurrences without changing their order', async () => {
		const good = { ...source, id: '999', title: 'Another song' };
		const deps = dependencies();
		const result = await verifyImportedRecordings(
			[source, good, source],
			'owner',
			{},
			'HIGH',
			deps
		);
		expect(result.tracks.map((track) => track.id)).toEqual([exact.id, good.id, exact.id]);
		expect(result).toMatchObject({ replacements: 2, bestFits: 0, skipped: 0 });
		expect(result.tracks[0].replacementForId).toBe(source.id);
	});
	it('supports a verified best fit when there is no same-ISRC candidate', async () => {
		const result = await verifyImportedRecordings(
			[source],
			'owner',
			{},
			'HIGH',
			dependencies([best])
		);
		expect(result).toMatchObject({ replacements: 1, bestFits: 1, skipped: 0 });
	});
	it('preserves a previously selected playable replacement on later imports', async () => {
		const deps = dependencies();
		const result = await verifyImportedRecordings(
			[source],
			'owner',
			{},
			'HIGH',
			deps,
			new Map([[source.id, best]])
		);
		expect(result.tracks[0].id).toBe(best.id);
		expect(deps.search).not.toHaveBeenCalled();
	});
	it('does not treat a service or rate-limit error as a missing match', async () => {
		const deps = dependencies();
		deps.search.mockRejectedValue(new Error('Provider unavailable'));
		await expect(verifyImportedRecordings([source], 'owner', {}, 'HIGH', deps)).rejects.toThrow(
			'Provider unavailable'
		);
	});
});

it('keeps an accepted local relink when archived source metadata changes later', async () => {
	const chosen = { ...best, title: 'Updated catalogue title', replacementForId: source.id };
	const deps = dependencies();
	const result = await verifyImportedRecordings(
		[source],
		'owner',
		{},
		'HIGH',
		deps,
		new Map([[source.id, chosen]])
	);
	expect(result.tracks[0].id).toBe(chosen.id);
	expect(deps.search).not.toHaveBeenCalled();
});
