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
	SMTP_HOST: {
		schema: optional,
		description: 'Postfix SMTP host used to deliver account-verification email.'
	},
	SMTP_PORT: {
		schema: optional,
		description: 'Postfix SMTP port. Defaults to 25.'
	},
	SMTP_USER: { schema: optional, description: 'Optional SMTP username.' },
	SMTP_PASSWORD: { schema: optional, description: 'Optional SMTP password.' },
	SMTP_FROM: {
		schema: optional,
		description: 'Sender address for Syn account-verification email.'
	},
	LASTFM_API_KEY: { schema: optional, description: 'Last.fm API key.' },
	LASTFM_APPLICATION_NAME: {
		schema: optional,
		description: 'Registered Last.fm application name.'
	},
	LASTFM_REGISTERED_TO: {
		schema: optional,
		description: 'Last.fm account to which the application is registered.'
	},
	LASTFM_SHARED_SECRET: {
		schema: optional,
		description: 'Last.fm API shared secret. Never expose this to the browser.'
	},
	LASTFM_TOKEN_ENC_KEY: {
		schema: optional,
		description:
			'Optional base64-encoded 32-byte key for Last.fm session-key encryption. Defaults to a key derived from BETTER_AUTH_SECRET.'
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
	}
});
