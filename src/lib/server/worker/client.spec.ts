import { describe, expect, it, vi } from 'vitest';
import {
	WorkerApiError,
	WorkerAuthenticationError,
	WorkerClient,
	WorkerConfigError,
	WorkerProtocolError,
	WorkerUnavailableError
} from './index';

const job = {
	id: 'job-1',
	state: 'QUEUED',
	resource: '123',
	quality: 'LOSSLESS',
	createdAt: '2026-09-03T08:00:00.000Z',
	updatedAt: '2026-09-03T08:00:00.000Z'
};

function client(fetch: typeof globalThis.fetch) {
	return new WorkerClient({
		baseUrl: 'https://worker.internal/',
		bearerToken: 'private-worker-credential',
		fetch
	});
}

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('WorkerClient', () => {
	it('sends Syn’s worker credential and validates health responses', async () => {
		const fetchMock = vi.fn<FetchMock>(async () =>
			Response.json({ status: 'ok', version: '1.0.0' })
		);

		await expect(client(fetchMock as never).health()).resolves.toEqual({
			status: 'ok',
			version: '1.0.0'
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(url.toString()).toBe('https://worker.internal/v1/health');
		expect(new Headers(init?.headers).get('authorization')).toBe(
			'Bearer private-worker-credential'
		);
	});

	it('creates jobs with a JSON body and reads a percent-encoded job id', async () => {
		const fetchMock = vi.fn<FetchMock>(async () => Response.json(job));
		const subject = client(fetchMock as never);

		await expect(
			subject.createDownloadJob({ jobId: 'syn-job-1', resource: '123', quality: 'LOSSLESS' })
		).resolves.toEqual(job);
		await expect(subject.getDownloadJob('job/a')).resolves.toEqual(job);

		expect(fetchMock.mock.calls[0][1]).toMatchObject({
			method: 'POST',
			body: JSON.stringify({ jobId: 'syn-job-1', resource: '123', quality: 'LOSSLESS' })
		});
		expect(fetchMock.mock.calls[1][0].toString()).toBe('https://worker.internal/v1/jobs/job%2Fa');
	});

	it('requests an opaque, short-lived browser playback URL', async () => {
		const session = {
			id: 'session-1',
			playbackUrl: 'https://worker.internal/play/opaque-ticket',
			expiresAt: '2026-09-03T08:10:00.000Z',
			mimeType: 'audio/flac',
			audioQuality: 'LOSSLESS'
		} as const;
		const fetchMock = vi.fn<FetchMock>(async () => Response.json(session));
		const response = await client(fetchMock as never).createPlaybackSession({
			jobId: 'syn-job-1',
			trackId: '42',
			quality: 'LOSSLESS',
			loudnessNormalization: true
		});

		expect(response).toEqual(session);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url.toString()).toBe('https://worker.internal/v1/playback/sessions');
		expect(init).toMatchObject({
			method: 'POST',
			body: JSON.stringify({
				jobId: 'syn-job-1',
				trackId: '42',
				quality: 'LOSSLESS',
				loudnessNormalization: true
			})
		});
	});

	it('maps unsafe configuration and never includes its credential in the error', () => {
		expect(
			() =>
				new WorkerClient({
					baseUrl: 'https://user:pass@worker.internal',
					bearerToken: 'do-not-leak'
				})
		).toThrow(WorkerConfigError);
		try {
			new WorkerClient({ baseUrl: 'not-a-url', bearerToken: 'do-not-leak' });
		} catch (error) {
			expect(String(error)).not.toContain('do-not-leak');
		}
	});

	it('maps worker failures without trusting a remote error body', async () => {
		await expect(
			client(
				vi.fn(async () => new Response('raw secret from upstream', { status: 401 })) as never
			).health()
		).rejects.toBeInstanceOf(WorkerAuthenticationError);
		await expect(
			client(vi.fn(async () => new Response('down', { status: 503 })) as never).health()
		).rejects.toBeInstanceOf(WorkerUnavailableError);
		await expect(
			client(vi.fn(async () => new Response('missing', { status: 404 })) as never).health()
		).rejects.toBeInstanceOf(WorkerApiError);
		await expect(
			client(vi.fn(async () => Response.json({ nope: true })) as never).health()
		).rejects.toBeInstanceOf(WorkerProtocolError);
	});

	it('maps fetch failures to a safe availability error', async () => {
		await expect(
			client(
				vi.fn(async () =>
					Promise.reject(new Error('connection refused: credential=private'))
				) as never
			).health()
		).rejects.toBeInstanceOf(WorkerUnavailableError);
	});
});
