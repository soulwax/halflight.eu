import { defineEnvVars } from '@sveltejs/kit/env';

/** Pass-through schema that makes a variable optional (`string | undefined`). */
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:3000`.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	GITHUB_CLIENT_ID: {
		description:
			'GitHub OAuth client ID. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).'
	},
	GITHUB_CLIENT_SECRET: {
		description:
			'GitHub OAuth client secret. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).'
	},
	ADMIN_USERNAME: {
		description:
			'Permanent Syn administrator username. It must match the intended GitHub login exactly, except for letter case.'
	},
	ADMIN_PASSWORD: {
		description:
			'Password for the permanent Syn administrator. Stored only as a Better Auth password hash after first use.'
	},
	TIDAL_CLIENT_ID: {
		schema: optional,
		description: 'TIDAL OAuth client ID from https://developer.tidal.com.'
	},
	TIDAL_CLIENT_SECRET: {
		schema: optional,
		description: 'TIDAL OAuth client secret. Required only for a confidential app.'
	},
	TIDAL_REDIRECT_URI: {
		schema: optional,
		description: 'TIDAL OAuth redirect URI. Defaults to `${ORIGIN}/tidal/callback`.'
	},
	TIDAL_SCOPES: {
		schema: optional,
		description: 'Space-separated TIDAL OAuth scopes. Defaults to a read-only set.'
	},
	TIDAL_TOKEN_ENC_KEY: {
		schema: optional,
		description:
			'Base64-encoded 32-byte key used to encrypt the stored TIDAL token record. Generate with `openssl rand -base64 32`.'
	},
	STREAMRIP_WORKER_URL: {
		schema: optional,
		description:
			"HTTPS URL of Syn's self-hosted streamrip worker. When unset, worker playback and downloads are unavailable."
	},
	STREAMRIP_WORKER_TOKEN: {
		schema: optional,
		description:
			"High-entropy bearer credential shared only by Syn's server and the self-hosted streamrip worker."
	}
});
