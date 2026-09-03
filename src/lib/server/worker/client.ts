import {
	WorkerApiError,
	WorkerAuthenticationError,
	WorkerConfigError,
	WorkerProtocolError,
	WorkerUnavailableError
} from './errors';
import {
	WORKER_AUDIO_QUALITIES,
	WORKER_DOWNLOAD_FORMATS,
	WORKER_JOB_STATES,
	type CreateDownloadJobRequest,
	type CreatePlaybackSessionRequest,
	type WorkerDownloadJob,
	type WorkerHealth,
	type WorkerPlaybackSession
} from './types';

export interface WorkerClientOptions {
	/** Base URL for the privately reachable worker, such as `http://worker:8080`. */
	baseUrl: string;
	/** Shared bearer credential between Syn and the self-hosted worker. */
	bearerToken: string;
	/** Injectable for SvelteKit and unit tests; defaults to the global fetch. */
	fetch?: typeof fetch;
}

function normaliseBaseUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new WorkerConfigError('WORKER_URL must be an absolute HTTP(S) URL.');
	}
	if (
		(url.protocol !== 'http:' && url.protocol !== 'https:') ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new WorkerConfigError('WORKER_URL must be an absolute HTTP(S) URL without credentials.');
	}
	return new URL(`${url.toString().replace(/\/+$/, '')}/`);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
	return isString(value) && values.includes(value);
}

function assertHealth(value: unknown): asserts value is WorkerHealth {
	if (
		!isObject(value) ||
		value.status !== 'ok' ||
		(value.version !== undefined && !isString(value.version))
	) {
		throw new WorkerProtocolError();
	}
}

function assertDownloadJob(value: unknown): asserts value is WorkerDownloadJob {
	if (
		!isObject(value) ||
		!isString(value.id) ||
		!isOneOf(value.state, WORKER_JOB_STATES) ||
		!isString(value.resource) ||
		!isOneOf(value.quality, WORKER_AUDIO_QUALITIES) ||
		!isString(value.createdAt) ||
		!isString(value.updatedAt)
	) {
		throw new WorkerProtocolError();
	}
	if (value.format !== undefined && !isOneOf(value.format, WORKER_DOWNLOAD_FORMATS)) {
		throw new WorkerProtocolError();
	}
	if (value.failureCode !== undefined && !isString(value.failureCode))
		throw new WorkerProtocolError();
	if (
		value.progress !== undefined &&
		(!isObject(value.progress) ||
			!isNumber(value.progress.completed) ||
			!isNumber(value.progress.total))
	) {
		throw new WorkerProtocolError();
	}
}

function assertPlaybackSession(value: unknown): asserts value is WorkerPlaybackSession {
	if (
		!isObject(value) ||
		!isString(value.id) ||
		!isString(value.playbackUrl) ||
		!isString(value.expiresAt)
	) {
		throw new WorkerProtocolError();
	}
	try {
		const url = new URL(value.playbackUrl);
		if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
			throw new WorkerProtocolError();
		}
	} catch (error) {
		if (error instanceof WorkerProtocolError) throw error;
		throw new WorkerProtocolError();
	}
	for (const key of ['mimeType', 'fileExtension'] as const) {
		if (value[key] !== undefined && !isString(value[key])) throw new WorkerProtocolError();
	}
	if (value.audioQuality !== undefined && !isOneOf(value.audioQuality, WORKER_AUDIO_QUALITIES)) {
		throw new WorkerProtocolError();
	}
}

/**
 * Typed HTTP boundary for Syn's self-hosted worker protocol (`/v1`). It never
 * sends provider credentials: only Syn's private worker credential is attached.
 */
export class WorkerClient {
	readonly #baseUrl: URL;
	readonly #bearerToken: string;
	readonly #fetch: typeof fetch;

	constructor(options: WorkerClientOptions) {
		if (!options.bearerToken.trim()) {
			throw new WorkerConfigError('WORKER_AUTH_TOKEN must not be empty.');
		}
		this.#baseUrl = normaliseBaseUrl(options.baseUrl);
		this.#bearerToken = options.bearerToken;
		this.#fetch = options.fetch ?? fetch;
	}

	async health(): Promise<WorkerHealth> {
		const body = await this.requestJson('health', '/v1/health');
		assertHealth(body);
		return body;
	}

	async createDownloadJob(input: CreateDownloadJobRequest): Promise<WorkerDownloadJob> {
		const body = await this.requestJson('create a download job', '/v1/jobs', {
			method: 'POST',
			body: JSON.stringify(input)
		});
		if (
			isObject(body) &&
			isString(body.id) &&
			isString(body.status) &&
			isObject(body.target) &&
			isString(body.target.resource_id) &&
			isObject(body.profile) &&
			isString(body.profile.quality) &&
			isString(body.created_at) &&
			isString(body.updated_at)
		) {
			return {
				id: body.id,
				state: body.status.toUpperCase() as WorkerDownloadJob['state'],
				resource: body.target.resource_id,
				quality: body.profile.quality as WorkerDownloadJob['quality'],
				...(isString(body.profile.output_format)
					? { format: body.profile.output_format.toUpperCase() as WorkerDownloadJob['format'] }
					: {}),
				createdAt: body.created_at,
				updatedAt: body.updated_at,
				...(isString(body.error_code) ? { failureCode: body.error_code } : {})
			};
		}
		assertDownloadJob(body);
		return body;
	}

	async getDownloadJob(id: string): Promise<WorkerDownloadJob> {
		const body = await this.requestJson(
			'read the download job',
			`/v1/jobs/${encodeURIComponent(id)}`
		);
		assertDownloadJob(body);
		return body;
	}

	async createPlaybackSession(input: CreatePlaybackSessionRequest): Promise<WorkerPlaybackSession> {
		const body = await this.requestJson('prepare playback', '/v1/playback/sessions', {
			method: 'POST',
			body: JSON.stringify(input)
		});
		assertPlaybackSession(body);
		return body;
	}

	private async requestJson(
		operation: string,
		path: string,
		init: RequestInit = {}
	): Promise<unknown> {
		const response = await this.request(operation, path, {
			...init,
			headers: {
				'content-type': 'application/json',
				...init.headers
			}
		});
		try {
			return await response.json();
		} catch {
			throw new WorkerProtocolError();
		}
	}

	private async request(
		operation: string,
		path: string,
		init: RequestInit = {}
	): Promise<Response> {
		let response: Response;
		try {
			response = await this.#fetch(new URL(path.replace(/^\//, ''), this.#baseUrl), {
				...init,
				headers: {
					accept: 'application/json',
					...init.headers,
					authorization: `Bearer ${this.#bearerToken}`
				}
			});
		} catch {
			throw new WorkerUnavailableError();
		}

		if (response.ok) return response;
		if (response.status === 401 || response.status === 403) throw new WorkerAuthenticationError();
		if (response.status === 502 || response.status === 503 || response.status === 504) {
			throw new WorkerUnavailableError();
		}
		throw new WorkerApiError(response.status, operation);
	}
}
