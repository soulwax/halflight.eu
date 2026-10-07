import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackSummary } from '#lib/tidal/models';
import { TidalApiError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), unavailable: vi.fn(), mark: vi.fn() }));
vi.mock('#lib/server/tidal/stream-cache', () => ({ resolveTrackStreamCached: mocks.resolve }));
vi.mock('#lib/server/tidal/track-playability', () => ({
	getUnplayableTrackIds: mocks.unavailable,
	markTrackUnplayable: mocks.mark,
	markTrackPlayable: vi.fn().mockResolvedValue(undefined)
}));
import { resetPlaylistPlaybackValidation, validatePlaylistPlayback } from './playback-validation';

const track = (id: string): TrackSummary => ({ kind: 'track', id, title: id, artists: [] });
const validate = (tracks: TrackSummary[], owner = 'owner') =>
	validatePlaylistPlayback(tracks, owner, {}, 'HIGH');

beforeEach(() => {
	resetPlaylistPlaybackValidation();
	mocks.resolve.mockReset().mockResolvedValue({});
	mocks.unavailable.mockReset().mockResolvedValue(new Set());
	mocks.mark.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('playlist playback validation', () => {
	it('keeps order and duplicates while probing each recording once', async () => {
		const tracks = [track('1'), track('2'), track('1')];
		expect(await validate(tracks)).toEqual(tracks);
		expect(mocks.resolve).toHaveBeenCalledTimes(2);
	});
	it('records and excludes only a confirmed asset failure', async () => {
		mocks.resolve.mockRejectedValueOnce(
			new TidalApiError(401, 'Asset is not ready for playback', { subStatus: 4005 }, '/playback')
		);
		expect(await validate([track('bad'), track('good'), track('bad')])).toEqual([track('good')]);
		expect(mocks.mark).toHaveBeenCalledOnce();
		expect(mocks.mark).toHaveBeenCalledWith('bad', 'asset not ready for playback');
	});
	it.each([401, 403, 429, 502])(
		'stops on %s without labelling a recording defective',
		async (status) => {
			const error = new TidalApiError(status, 'Request failed', null, '/playback');
			mocks.resolve.mockRejectedValueOnce(error);
			await expect(validate([track('one'), track('two')])).rejects.toBe(error);
			expect(mocks.mark).not.toHaveBeenCalled();
			expect(mocks.resolve).toHaveBeenCalledOnce();
		}
	);
	it('skips known defects and never reorders the remaining entries', async () => {
		mocks.unavailable.mockResolvedValue(new Set(['bad']));
		expect(await validate([track('bad'), track('good')])).toEqual([track('good')]);
		expect(mocks.resolve).toHaveBeenCalledOnce();
	});
	it('reuses recent successful probes for the same owner and quality, then expires them', async () => {
		vi.useFakeTimers();
		await validate([track('1')]);
		await validate([track('1')]);
		expect(mocks.resolve).toHaveBeenCalledOnce();
		await validate([track('1')], 'different-owner');
		expect(mocks.resolve).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(15 * 60 * 1_000);
		await validate([track('1')]);
		expect(mocks.resolve).toHaveBeenCalledTimes(3);
	});
	it('honours provider throttling before another probe can start', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{}', { status: 429, headers: { 'retry-after': '60' } }));
		mocks.resolve.mockImplementation(async (_id, options) => {
			const response = await options.ctx.fetch('https://api.tidal.com/playback');
			if (!response.ok)
				throw new TidalApiError(response.status, 'Request failed', null, '/playback');
		});
		await expect(
			validatePlaylistPlayback([track('one')], 'owner', { fetch: fetchMock }, 'HIGH')
		).rejects.toMatchObject({ status: 429 });
		await expect(
			validatePlaylistPlayback([track('two')], 'owner', { fetch: fetchMock }, 'HIGH')
		).rejects.toMatchObject({ status: 429 });
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(mocks.mark).not.toHaveBeenCalled();
	});
});

it('excludes a retired recording reported as track not found', async () => {
	mocks.resolve.mockRejectedValueOnce(
		new TidalApiError(404, 'Not Found', { subStatus: 2001 }, '/playback')
	);
	expect(await validate([track('18343352'), track('good')])).toEqual([track('good')]);
	expect(mocks.mark).toHaveBeenCalledWith('18343352', 'asset not ready for playback');
});
