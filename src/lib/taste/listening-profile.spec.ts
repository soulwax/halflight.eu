import { describe, expect, it } from 'vitest';
import {
	applyQualifiedListen,
	emptyListeningEvidence,
	listeningAffinities
} from './listening-profile';
const now = new Date('2026-10-08T12:00:00Z');
const input = {
	receipt: 'one',
	listenedSeconds: 31,
	artistIds: ['artist'],
	genres: [{ name: 'rock', weight: 100 }]
};
describe('qualified listening profile', () => {
	it('requires more than thirty seconds and deduplicates delivery receipts', () => {
		const empty = emptyListeningEvidence();
		expect(applyQualifiedListen(empty, { ...input, listenedSeconds: 30 }, now).accepted).toBe(
			false
		);
		const first = applyQualifiedListen(empty, input, now);
		expect(first.accepted).toBe(true);
		expect(applyQualifiedListen(first.state, input, now)).toEqual({
			accepted: false,
			state: first.state
		});
	});
	it('shares credit across collaborators and genres rather than duplicating a play', () => {
		const { state } = applyQualifiedListen(
			emptyListeningEvidence(),
			{
				...input,
				artistIds: ['a', 'b', 'a'],
				genres: [
					{ name: 'rock', weight: 50 },
					{ name: 'pop', weight: 50 }
				]
			},
			now
		);
		expect(state.artists.a.mass).toBe(0.5);
		expect(state.artists.b.mass).toBe(0.5);
		expect(state.genres.rock.mass).toBe(0.5);
	});
	it('diminishes daily repeats, caps their influence, and starts fresh daily', () => {
		let state = emptyListeningEvidence();
		for (let i = 0; i < 20; i++)
			state = applyQualifiedListen(state, { ...input, receipt: String(i) }, now).state;
		const expected = Array.from({ length: 6 }, (_, i) => 1 / Math.sqrt(i + 1)).reduce(
			(a, b) => a + b,
			0
		);
		expect(state.artists.artist.mass).toBeCloseTo(expected);
		expect(state.genres.rock.mass).toBeCloseTo(expected);
		const tomorrow = new Date(now.getTime() + 86_400_000);
		state = applyQualifiedListen(state, { ...input, receipt: 'tomorrow' }, tomorrow).state;
		expect(state.artists.artist.mass).toBeCloseTo(expected * 2 ** (-1 / 90) + 1);
	});
	it('keeps confidence low with little evidence and does not invent unknown genres', () => {
		const { state } = applyQualifiedListen(emptyListeningEvidence(), { ...input, genres: [] }, now);
		const profile = listeningAffinities(state, now);
		expect(profile.artists).toEqual({ artist: 1 });
		expect(profile.confidence).toBeLessThan(0.05);
		expect(profile.genres).toEqual({});
		expect(profile.genreConfidence).toBe(0);
	});
});
