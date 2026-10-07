import { describe, expect, it, vi } from 'vitest';
import {
	describePlaybackDelivery,
	fetchTrackStream,
	parseManifestXml,
	parseTrackStream,
	resolveTrackStream,
	TidalQualityDeniedError,
	type TrackStreamResponse
} from './stream';
import { writePlaybackRecord, type TokenRowStore, type TokenSlot } from './store';
import { TidalApiError, TidalError } from './errors';

function memoryStore(): TokenRowStore {
	const blobs: Record<TokenSlot, string | null> = { primary: null, playback: null };
	return {
		read: async (slot = 'primary') => blobs[slot],
		write: async (v, slot = 'primary') => void (blobs[slot] = v),
		clear: async (slot = 'primary') => void (blobs[slot] = null)
	};
}

function btsResponse(quality: string): { ok: true; json: () => Promise<TrackStreamResponse> } {
	const manifest = Buffer.from(
		JSON.stringify({
			mimeType: quality === 'LOSSLESS' ? 'audio/flac' : 'audio/mp4',
			codecs: quality === 'LOSSLESS' ? 'flac' : 'mp4a.40.2',
			encryptionType: 'NONE',
			urls: [`https://cdn.tidal.com/${quality}.file`]
		})
	).toString('base64');
	return {
		ok: true,
		json: async () => ({
			trackId: 1,
			assetPresentation: 'FULL',
			audioMode: 'STEREO',
			audioQuality: quality as TrackStreamResponse['audioQuality'],
			manifestMimeType: 'application/vnd.tidal.bts',
			manifestHash: 'h',
			manifest
		})
	};
}

const qualityDenied = {
	ok: false,
	status: 401,
	json: async () => ({
		status: 401,
		subStatus: 5003,
		userMessage: 'Requested quality is not allowed'
	})
};

/** A HiRes DASH manifest shaped like TIDAL's: init segment + numbered fragments. */
const HI_RES_MPD = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static">
	<Period>
		<AdaptationSet contentType="audio" mimeType="audio/mp4">
			<Representation id="1" codecs="flac" bandwidth="1152000" audioSamplingRate="96000">
				<SegmentTemplate
					timescale="96000"
					initialization="https://sp-ad-cf.audio.tidal.com/init.mp4"
					media="https://sp-ad-cf.audio.tidal.com/seg-$Number$.mp4"
					startNumber="1">
					<SegmentTimeline>
						<S t="0" d="960000" r="3" />
						<S d="480000" />
					</SegmentTimeline>
				</SegmentTemplate>
			</Representation>
		</AdaptationSet>
	</Period>
</MPD>`;

describe('stream manifest parsing (translated from tiddl / OrpheusDL-TIDAL)', () => {
	it('parses a HiRes DASH manifest: init segment first, then numbered fragments', () => {
		const res = parseManifestXml(HI_RES_MPD);
		expect(res.codecs).toBe('flac');
		expect(res.bitrateKbps).toBe(1152);
		expect(res.sampleRateHz).toBe(96000);
		expect(res.initUrl).toBe('https://sp-ad-cf.audio.tidal.com/init.mp4');
		// <S r=3> => 4 segments, plus the trailing <S> => 5, numbered from startNumber=1.
		expect(res.mediaUrls).toEqual([
			'https://sp-ad-cf.audio.tidal.com/seg-1.mp4',
			'https://sp-ad-cf.audio.tidal.com/seg-2.mp4',
			'https://sp-ad-cf.audio.tidal.com/seg-3.mp4',
			'https://sp-ad-cf.audio.tidal.com/seg-4.mp4',
			'https://sp-ad-cf.audio.tidal.com/seg-5.mp4'
		]);
	});

	it('defaults startNumber to 1 and tolerates a missing init segment', () => {
		const res = parseManifestXml(
			HI_RES_MPD.replace(/initialization="[^"]*"\s*/, '').replace(/startNumber="1"/, '')
		);
		expect(res.initUrl).toBeNull();
		expect(res.mediaUrls[0]).toBe('https://sp-ad-cf.audio.tidal.com/seg-1.mp4');
		expect(res.mediaUrls).toHaveLength(5);
	});

	it('parseTrackStream prepends the init segment and marks the stream segmented', () => {
		const parsed = parseTrackStream({
			trackId: 42,
			assetPresentation: 'FULL',
			audioMode: 'STEREO',
			audioQuality: 'HI_RES_LOSSLESS',
			manifestMimeType: 'application/dash+xml',
			manifestHash: 'h',
			manifest: Buffer.from(HI_RES_MPD).toString('base64')
		});
		expect(parsed.segmented).toBe(true);
		expect(parsed.urls[0]).toBe('https://sp-ad-cf.audio.tidal.com/init.mp4');
		expect(parsed.urls).toHaveLength(6);
		expect(parsed.mimeType).toBe('audio/mp4');
		expect(parsed.fileExtension).toBe('.m4a');
		expect(parsed.bitrateKbps).toBe(1152);
		expect(parsed.sampleRateHz).toBe(96000);
	});

	it('throws on malformed DASH XML missing SegmentTemplate media', () => {
		const xml = `
			<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
				<Representation codecs="flac">
					<SegmentTemplate>
					</SegmentTemplate>
				</Representation>
			</MPD>
		`;
		expect(() => parseManifestXml(xml)).toThrow(TidalError);
	});

	it('parses application/vnd.tidal.bts manifest for AAC / HIGH quality', () => {
		const manifestData = {
			mimeType: 'audio/mp4',
			codecs: 'mp4a.40.2',
			encryptionType: 'NONE',
			urls: ['https://sp-pr-cf.audio.tidal.com/stream-aac.m4a']
		};
		const stream: TrackStreamResponse = {
			trackId: 12345,
			assetPresentation: 'FULL',
			audioMode: 'STEREO',
			audioQuality: 'HIGH',
			manifestMimeType: 'application/vnd.tidal.bts',
			manifestHash: 'hash1',
			manifest: Buffer.from(JSON.stringify(manifestData)).toString('base64'),
			bitDepth: 16,
			sampleRate: 44100
		};

		const parsed = parseTrackStream(stream);
		expect(parsed.urls).toEqual(['https://sp-pr-cf.audio.tidal.com/stream-aac.m4a']);
		expect(parsed.fileExtension).toBe('.m4a');
		expect(parsed.mimeType).toBe('audio/mp4');
		expect(parsed.codecs).toBe('mp4a.40.2');
	});

	it.each(['OLD_AES', 'AES', 'aes-128'])(
		'refuses a BTS manifest encrypted with %s rather than serving undecodable bytes',
		(encryptionType) => {
			// Syn proxies CDN bytes verbatim and has no content-key handling, so an
			// encrypted stream would arrive plausible-sized and unplayable — an
			// opaque MediaError code 3. Fail where the cause is still legible.
			const stream: TrackStreamResponse = {
				trackId: 424242,
				assetPresentation: 'FULL',
				audioMode: 'STEREO',
				audioQuality: 'LOSSLESS',
				manifestMimeType: 'application/vnd.tidal.bts',
				manifestHash: 'hash-enc',
				manifest: Buffer.from(
					JSON.stringify({
						mimeType: 'audio/flac',
						codecs: 'flac',
						encryptionType,
						urls: ['https://sp-pr-cf.audio.tidal.com/stream-flac.flac']
					})
				).toString('base64')
			};

			expect(() => parseTrackStream(stream)).toThrow(TidalError);
			expect(() => parseTrackStream(stream)).toThrow(/424242/);
		}
	);

	it('treats an absent encryptionType as unencrypted', () => {
		const stream: TrackStreamResponse = {
			trackId: 5150,
			assetPresentation: 'FULL',
			audioMode: 'STEREO',
			audioQuality: 'HIGH',
			manifestMimeType: 'application/vnd.tidal.bts',
			manifestHash: 'hash-noenc',
			manifest: Buffer.from(
				JSON.stringify({
					mimeType: 'audio/mp4',
					codecs: 'mp4a.40.2',
					urls: ['https://sp-pr-cf.audio.tidal.com/stream-aac.m4a']
				})
			).toString('base64')
		};

		expect(parseTrackStream(stream).codecs).toBe('mp4a.40.2');
	});

	it('parses application/vnd.tidal.bts manifest for LOSSLESS FLAC', () => {
		const manifestData = {
			mimeType: 'audio/flac',
			codecs: 'flac',
			encryptionType: 'NONE',
			urls: ['https://sp-pr-cf.audio.tidal.com/stream-flac.flac']
		};
		const stream: TrackStreamResponse = {
			trackId: 67890,
			assetPresentation: 'FULL',
			audioMode: 'STEREO',
			audioQuality: 'LOSSLESS',
			manifestMimeType: 'application/vnd.tidal.bts',
			manifestHash: 'hash2',
			manifest: Buffer.from(JSON.stringify(manifestData)).toString('base64'),
			bitDepth: 16,
			sampleRate: 44100
		};

		const parsed = parseTrackStream(stream);
		expect(parsed.urls).toEqual(['https://sp-pr-cf.audio.tidal.com/stream-flac.flac']);
		expect(parsed.fileExtension).toBe('.flac');
		expect(parsed.mimeType).toBe('audio/flac');
		expect(parsed.codecs).toBe('flac');
	});

	it('handles Dolby Atmos eac3 codec mapping to .m4a', () => {
		const manifestData = {
			mimeType: 'audio/mp4',
			codecs: 'eac3',
			encryptionType: 'NONE',
			urls: ['https://sp-pr-cf.audio.tidal.com/stream-atmos.m4a']
		};
		const stream: TrackStreamResponse = {
			trackId: 11223,
			assetPresentation: 'FULL',
			audioMode: 'DOLBY_ATMOS',
			audioQuality: 'HIGH',
			manifestMimeType: 'application/vnd.tidal.bts',
			manifestHash: 'hash3',
			manifest: Buffer.from(JSON.stringify(manifestData)).toString('base64')
		};

		const parsed = parseTrackStream(stream);
		expect(parsed.fileExtension).toBe('.m4a');
		expect(parsed.codecs).toBe('eac3');
	});

	it('throws for unknown codecs', () => {
		const manifestData = {
			mimeType: 'audio/unknown',
			codecs: 'vorbis',
			encryptionType: 'NONE',
			urls: ['https://sp-pr-cf.audio.tidal.com/stream.ogg']
		};
		const stream: TrackStreamResponse = {
			trackId: 99999,
			assetPresentation: 'FULL',
			audioMode: 'STEREO',
			audioQuality: 'HIGH',
			manifestMimeType: 'application/vnd.tidal.bts',
			manifestHash: 'hash4',
			manifest: Buffer.from(JSON.stringify(manifestData)).toString('base64')
		};

		expect(() => parseTrackStream(stream)).toThrow(TidalError);
	});
});

describe('playback delivery descriptions', () => {
	it('keeps lossless streams as FLAC and reports no fake fixed bitrate', () => {
		expect(
			describePlaybackDelivery({ audioQuality: 'LOSSLESS', codecs: 'flac', mimeType: 'audio/flac' })
		).toEqual({
			format: 'flac',
			mimeType: 'audio/flac',
			lossless: true,
			nominalBitrateKbps: null
		});
	});

	it('describes the native lossy tiers accurately', () => {
		expect(
			describePlaybackDelivery({ audioQuality: 'HIGH', codecs: 'mp4a.40.2', mimeType: 'audio/mp4' })
		).toMatchObject({ format: 'aac', nominalBitrateKbps: 320, lossless: false });
		expect(
			describePlaybackDelivery({ audioQuality: 'LOW', codecs: 'mp4a.40.2', mimeType: 'audio/mp4' })
		).toMatchObject({ format: 'aac', nominalBitrateKbps: 96, lossless: false });
	});

	it('marks HiRes lossless as its own fMP4 format', () => {
		expect(
			describePlaybackDelivery({
				audioQuality: 'HI_RES_LOSSLESS',
				codecs: 'flac',
				mimeType: 'audio/mp4'
			})
		).toEqual({
			format: 'hi_res',
			mimeType: 'audio/mp4',
			lossless: true,
			nominalBitrateKbps: null
		});
	});
});

describe('fetchTrackStream', () => {
	it('performs authenticated GET to playbackinfopostpaywall and returns resolved stream', async () => {
		const manifestData = {
			mimeType: 'audio/mp4',
			codecs: 'mp4a.40.2',
			encryptionType: 'NONE',
			urls: ['https://sp-pr-cf.audio.tidal.com/full-track.mp4']
		};

		const mockResponse: TrackStreamResponse = {
			trackId: 445566,
			assetPresentation: 'FULL',
			audioMode: 'STEREO',
			audioQuality: 'HIGH',
			manifestMimeType: 'application/vnd.tidal.bts',
			manifestHash: 'h1',
			manifest: Buffer.from(JSON.stringify(manifestData)).toString('base64'),
			bitDepth: 16,
			sampleRate: 44100
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse
		});

		const res = await fetchTrackStream('445566', {
			quality: 'HIGH',
			accessToken: 'test-token',
			ctx: { fetch: fetchMock as unknown as typeof fetch }
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.tidal.com/v1/tracks/445566/playbackinfopostpaywall?audioquality=HIGH&playbackmode=STREAM&assetpresentation=FULL',
			{
				headers: {
					authorization: 'Bearer test-token',
					accept: 'application/json'
				}
			}
		);

		expect(res.streamUrl).toBe('https://sp-pr-cf.audio.tidal.com/full-track.mp4');
		expect(res.mimeType).toBe('audio/mp4');
		expect(res.audioQuality).toBe('HIGH');
		expect(res.bitDepth).toBe(16);
	});

	it('throws TidalApiError on HTTP error response', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({
				status: 401,
				subStatus: 4005,
				userMessage: 'Asset is not ready for playback'
			})
		});

		await expect(
			fetchTrackStream('445566', {
				accessToken: 'bad-token',
				ctx: { fetch: fetchMock as unknown as typeof fetch }
			})
		).rejects.toThrow(TidalApiError);
	});

	it('resolves a HiRes DASH stream to an ordered segment list', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async (): Promise<TrackStreamResponse> => ({
				trackId: 9,
				assetPresentation: 'FULL',
				audioMode: 'STEREO',
				audioQuality: 'HI_RES_LOSSLESS',
				manifestMimeType: 'application/dash+xml',
				manifestHash: 'h',
				manifest: Buffer.from(HI_RES_MPD).toString('base64'),
				bitDepth: 24
			})
		});

		const res = await fetchTrackStream('9', {
			quality: 'HI_RES_LOSSLESS',
			accessToken: 't',
			ctx: { fetch: fetchMock as never }
		});

		expect(res.segmented).toBe(true);
		expect(res.urls).toHaveLength(6);
		expect(res.streamUrl).toBe('https://sp-ad-cf.audio.tidal.com/init.mp4');
		expect(res.bitDepth).toBe(24);
		expect(res.sampleRate).toBe(96000); // filled from the MPD when the API omits it
		expect(res.bitrateKbps).toBe(1152);
	});
});

describe('resolveTrackStream quality ladder', () => {
	const assetUnavailable = () => ({
		ok: false,
		status: 401,
		json: async () => ({ userMessage: 'Asset is not ready for playback' })
	});
	async function storeWithPlayback() {
		const store = memoryStore();
		await writePlaybackRecord(
			{
				accessToken: 't',
				refreshToken: 'r',
				expiresAt: Date.now() + 3_600_000,
				tokenType: 'Bearer',
				scope: ['r_usr'],
				obtainedAt: Date.now()
			},
			store
		);
		return store;
	}

	it('walks down past "quality not allowed" to the first allowed tier', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes('audioquality=HI_RES_LOSSLESS')) return qualityDenied;
			if (url.includes('audioquality=LOSSLESS')) return qualityDenied;
			if (url.includes('audioquality=HIGH')) return btsResponse('HIGH');
			throw new Error('should not reach LOW');
		});

		const res = await resolveTrackStream('1', {
			ctx: { fetch: fetchMock as never, store }
		});
		expect(res.audioQuality).toBe('HIGH');
		expect(res.streamUrl).toBe('https://cdn.tidal.com/HIGH.file');
	});

	it('throws TidalQualityDeniedError when every tier is refused', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async () => qualityDenied);

		await expect(
			resolveTrackStream('1', { ctx: { fetch: fetchMock as never, store } })
		).rejects.toBeInstanceOf(TidalQualityDeniedError);
		expect(fetchMock).toHaveBeenCalledTimes(4); // HI_RES_LOSSLESS, LOSSLESS, HIGH, LOW
	});
	it('tries a lower quality before treating an asset as unavailable', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async (url: string) =>
			url.includes('audioquality=HI_RES_LOSSLESS') ? assetUnavailable() : btsResponse('LOSSLESS')
		);
		const stream = await resolveTrackStream('1', { ctx: { fetch: fetchMock as never, store } });
		expect(stream.audioQuality).toBe('LOSSLESS');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
	it('never raises the requested quality during fallback', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async (url: string) =>
			url.includes('audioquality=HIGH') ? assetUnavailable() : btsResponse('LOW')
		);
		const stream = await resolveTrackStream('1', {
			quality: 'HIGH',
			ctx: { fetch: fetchMock as never, store }
		});
		expect(stream.audioQuality).toBe('LOW');
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls.every(([url]) => !url.includes('LOSSLESS'))).toBe(true);
	});
	it('does not exclude a track that is only available above the requested quality', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async (url: string) =>
			url.includes('audioquality=HI_RES_LOSSLESS')
				? btsResponse('HI_RES_LOSSLESS')
				: assetUnavailable()
		);
		await expect(
			resolveTrackStream('1', { quality: 'HIGH', ctx: { fetch: fetchMock as never, store } })
		).rejects.toMatchObject({
			message: 'No stream is available at the requested quality or below.'
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
	it('confirms unavailable only after every quality has been attempted', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async () => assetUnavailable());
		await expect(
			resolveTrackStream('1', { ctx: { fetch: fetchMock as never, store } })
		).rejects.toMatchObject({ status: 401, statusText: 'Asset is not ready for playback' });
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
	it('keeps an entitled asset failure distinct from denied subscription qualities', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async (url: string) =>
			url.includes('audioquality=HIGH') ? assetUnavailable() : qualityDenied
		);
		await expect(
			resolveTrackStream('1', { ctx: { fetch: fetchMock as never, store } })
		).rejects.toMatchObject({ statusText: 'Asset is not ready for playback' });
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
	it('does not turn an authentication failure after an asset failure into an exclusion', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(assetUnavailable())
			.mockResolvedValue({
				ok: false,
				status: 401,
				json: async () => ({ userMessage: 'Token expired' })
			});
		await expect(
			resolveTrackStream('1', { ctx: { fetch: fetchMock as never, store } })
		).rejects.toMatchObject({ statusText: 'Token expired' });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('surfaces a non-quality auth error immediately without walking the ladder', async () => {
		const store = await storeWithPlayback();
		const fetchMock = vi.fn(async () => ({
			ok: false,
			status: 401,
			json: async () => ({ status: 401, subStatus: 11002, userMessage: 'Token expired' })
		}));

		await expect(
			resolveTrackStream('1', { ctx: { fetch: fetchMock as never, store } })
		).rejects.toBeInstanceOf(TidalApiError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

it('refuses a stream manifest for a different recording ID', async () => {
	const fetchMock = vi.fn().mockResolvedValue(Response.json({ trackId: 999 }));
	await expect(
		fetchTrackStream('18343352', { accessToken: 'test-token', ctx: { fetch: fetchMock } })
	).rejects.toThrow('did not match the requested recording');
});
