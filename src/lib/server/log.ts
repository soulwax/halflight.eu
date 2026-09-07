import { dev } from '$app/env';

/**
 * Minimal server-side structured logger. One JSON line per event in production
 * (so a host log drain can parse it), a readable line in dev. Field keys that
 * look like they hold credentials are redacted before anything is written — this
 * module is the only sanctioned way for server code to log.
 */

type Fields = Record<string, unknown>;

const SECRET_KEY = /token|secret|authoriz|cookie|password|bearer|api[-_]?key/i;

function redact(fields: Fields): Fields {
	const safe: Fields = {};
	for (const [key, value] of Object.entries(fields)) {
		safe[key] = SECRET_KEY.test(key) ? '[redacted]' : value;
	}
	return safe;
}

function serialiseError(value: unknown): unknown {
	if (value instanceof Error) {
		// Error text frequently originates with a provider, database, or request
		// parser. Its class is enough to group failures without retaining a raw
		// response, secret, or personal data in operational logs.
		return { name: value.name };
	}
	return value;
}

function serialiseFields(fields: Fields): Fields {
	return Object.fromEntries(
		Object.entries(redact(fields)).map(([key, value]) => [key, serialiseError(value)])
	);
}

type Level = 'error' | 'warn' | 'info';

function emit(level: Level, message: string, fields?: Fields): void {
	const safe = fields ? serialiseFields(fields) : undefined;
	if (dev) {
		console[level](`[${level}] ${message}`, safe ?? '');
		return;
	}
	console[level](
		JSON.stringify({
			level,
			message,
			time: new Date().toISOString(),
			...(safe ?? {})
		})
	);
}

export const log = {
	error: (message: string, fields?: Fields) => emit('error', message, fields),
	warn: (message: string, fields?: Fields) => emit('warn', message, fields),
	info: (message: string, fields?: Fields) => emit('info', message, fields)
};
