/** Base class for every error surfaced by the TIDAL modules. */
export class TidalError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
	}
}

/** A required environment variable is missing or malformed. */
export class TidalConfigError extends TidalError {}

/** No token record is stored — the user has never connected, or has disconnected. */
export class TidalNotConnectedError extends TidalError {
	constructor(message = 'TIDAL is not connected. Connect an account first.') {
		super(message);
	}
}

/** The stored token record exists but could not be decrypted or parsed. */
export class TidalStoreError extends TidalError {}

/**
 * The stored refresh token was rejected (e.g. revoked, expired, or the
 * encryption key changed). The caller must reconnect.
 */
export class TidalAuthError extends TidalError {
	constructor(message = 'TIDAL authorization is no longer valid. Reconnect the account.') {
		super(message);
	}
}

/**
 * Full-quality playback needs a TIDAL Link (device-authorization) token with the
 * `r_usr` scope, and none is stored. The account may still be connected for
 * browsing via the developer OAuth token.
 */
export class TidalPlaybackNotLinkedError extends TidalError {
	constructor(
		message = 'Full playback is not linked. Authorize playback via TIDAL Link in settings.'
	) {
		super(message);
	}
}

/** A TIDAL API request failed with a non-2xx status that is not a handled auth error. */
export class TidalApiError extends TidalError {
	constructor(
		readonly status: number,
		readonly statusText: string,
		readonly body: unknown,
		readonly path: string
	) {
		super(`TIDAL API ${status} ${statusText} for ${path}`);
	}
}

/**
 * TIDAL answered a playback request with a manifest for another recording ID
 * (a silently remapped catalogue entry). The requested recording itself is not
 * playable; the served one must earn its place through identity matching.
 */
export class TidalRecordingRemappedError extends TidalError {
	constructor(
		readonly requestedTrackId: string,
		readonly servedTrackId: string
	) {
		super('Playback response did not match the requested recording');
	}
}

/** The user denied authorization on the TIDAL consent screen. */
