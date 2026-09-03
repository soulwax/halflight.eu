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

describe('stream manifest parsing (translated from tiddl)', () => {
	it('parses DASH XML manifest and expands timeline numbers', () => {
		const xml = `
			<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
				<Period>
					<AdaptationSet>
						<Representation codecs="flac">
							<SegmentTemplate media="https://audio.tidal.com/seg-$Number$.mp4">
								<SegmentTimeline>
									<S t="0" d="1000" r="2" />
									<S d="1000" />
								</SegmentTimeline>
							</SegmentTemplate>
						</Representation>
					</AdaptationSet>
				</Period>
			</MPD>
		`;

		const res = parseManifestXml(xml);
		expect(res.codecs).toBe('flac');
		// r=2 means 1 initial + 2 repeats = 3 segments, plus the second <S> = 1 segment -> total count = 4 (indices 0..4)
		expect(res.urls).toEqual([
			'https://audio.tidal.com/seg-0.mp4',
			'https://audio.tidal.com/seg-1.mp4',
			'https://audio.tidal.com/seg-2.mp4',
			'https://audio.tidal.com/seg-3.mp4',
			'https://audio.tidal.com/seg-4.mp4'
		]);
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
});

describe('resolveTrackStream quality ladder', () => {
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
		expect(fetchMock).toHaveBeenCalledTimes(3); // LOSSLESS, HIGH, LOW
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
