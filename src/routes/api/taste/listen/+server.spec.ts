import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyListeningEvidence, type ListeningEvidence } from '#lib/taste/listening-profile';
const mocks = vi.hoisted(() => ({ track: vi.fn(), genres: vi.fn(), mutate: vi.fn() }));
vi.mock('#lib/server/tidal/api', () => ({ getTrack: mocks.track }));
vi.mock('#lib/server/tidal/normalise', () => ({ normaliseTrackDetail: (value: unknown) => value }));
vi.mock('#lib/server/taste/lastfm-listening', () => ({ genresForPlayedTrack: mocks.genres }));
vi.mock('#lib/server/taste/listening-store', () => ({ mutateListeningEvidence: mocks.mutate }));
import { POST } from './+server';
let state: ListeningEvidence;
function event(body: unknown, listener = true) {
	return {
		locals: { user: { id: 'owner' }, isListener: listener },
		request: new Request('http://localhost/api/taste/listen', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		fetch,
		cookies: {}
	} as unknown as Parameters<typeof POST>[0];
}
const body = () => ({
	eventId: 'event-1',
	trackId: '123',
	listenedSeconds: 31,
	observedAt: Date.now(),
	artistIds: ['forged']
});
beforeEach(() => {
	vi.clearAllMocks();
	state = emptyListeningEvidence();
	mocks.track.mockResolvedValue({
		id: '123',
		title: 'Canonical',
		artists: [{ id: 'canonical', name: 'Artist' }]
	});
	mocks.genres.mockResolvedValue([{ name: 'rock', weight: 100 }]);
	mocks.mutate.mockImplementation(
		async (_user: string, update: (value: ListeningEvidence) => ListeningEvidence) => {
			state = update(state);
		}
	);
});
describe('qualified listening endpoint', () => {
	it('requires a listener and rejects unqualified or stale events before fetching metadata', async () => {
		await expect(POST(event(body(), false))).rejects.toMatchObject({ status: 401 });
		await expect(POST(event({ ...body(), listenedSeconds: 30 }))).rejects.toMatchObject({
			status: 400
		});
		await expect(
			POST(event({ ...body(), observedAt: Date.now() - 16 * 60_000 }))
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.track).not.toHaveBeenCalled();
	});
	it('uses canonical artists, stores only aggregates and hashes, and ignores replayed receipts', async () => {
		const response = await POST(event(body()));
		expect(await response.json()).toEqual({ accepted: true });
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(Object.keys(state.artists)).toEqual(['canonical']);
		expect(state.receipts[0]).toMatch(/^[a-f0-9]{64}$/);
		expect(JSON.stringify(state)).not.toContain('Canonical');
		expect(await (await POST(event(body()))).json()).toEqual({ accepted: false });
		expect(state.qualifiedPlays).toBe(1);
	});
	it('rejects a mismatched canonical recording instead of crediting another song', async () => {
		mocks.track.mockResolvedValue({ id: '456', title: 'Wrong', artists: [] });
		await expect(POST(event(body()))).rejects.toMatchObject({ status: 404 });
		expect(mocks.mutate).not.toHaveBeenCalled();
	});
});
