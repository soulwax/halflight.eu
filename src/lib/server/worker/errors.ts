/** Base error for the worker boundary. Messages are safe to show to a user. */
export class WorkerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

/** The worker URL or bearer credential was not supplied or is unsafe. */
export class WorkerConfigError extends WorkerError {}

/** The worker rejected Syn's internal bearer credential. */
export class WorkerAuthenticationError extends WorkerError {
	constructor() {
		super('The media worker rejected Syn’s credentials. Check the worker configuration.');
	}
}

/** The worker could not be reached, or is temporarily unavailable. */
export class WorkerUnavailableError extends WorkerError {
	constructor() {
		super('The media worker is temporarily unavailable. Try again shortly.');
	}
}

/** The worker returned a response that does not satisfy the Syn worker protocol. */
export class WorkerProtocolError extends WorkerError {
	constructor() {
		super('The media worker returned an unexpected response.');
	}
}

/** A non-authenticated HTTP failure returned by the worker. */
export class WorkerApiError extends WorkerError {
	constructor(
		readonly status: number,
		readonly operation: string
	) {
		super(`The media worker could not ${operation}.`);
	}
}
