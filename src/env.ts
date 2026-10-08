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
			'Permanent Halflight administrator username. It must match the intended GitHub login exactly, except for letter case. It is resolved to an immutable GitHub user id; display names never grant ownership.'
	},
	ADMIN_GITHUB_ID: {
		schema: optional,
		description:
			'Optional numeric GitHub user id of the administrator. Pins ownership to that account and skips resolving `ADMIN_USERNAME` through the GitHub API.'
	},
	ADMIN_PASSWORD: {
		description:
			'Password for the permanent Halflight administrator. Stored only as a Better Auth password hash after first use.'
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
		description: 'Sender address for Halflight account-verification email.'
	},
	REDIS_CACHE: {
		schema: optional,
		description:
			'Optional Redis URL for short-lived server-side derived caches and coordination. It is never browser-reachable.'
	},
	HALFLIGHT_EXPORT_BUCKET: {
		schema: optional,
		description: 'Optional S3-compatible bucket used only for short-lived owner-requested exports.'
	},
	HALFLIGHT_EXPORT_BUCKET_ENDPOINT: {
		schema: optional,
		description: 'Optional S3-compatible endpoint for the short-lived export bucket.'
	},
	HALFLIGHT_EXPORT_BUCKET_REGION: {
		schema: optional,
		description: 'Optional S3 region for the short-lived export bucket. Defaults to auto.'
	},
	HALFLIGHT_EXPORT_BUCKET_ACCESS_KEY_ID: {
		schema: optional,
		description: 'Server-only access key for the short-lived export bucket.'
	},
	HALFLIGHT_EXPORT_BUCKET_SECRET_ACCESS_KEY: {
		schema: optional,
		description: 'Server-only secret key for the short-lived export bucket.'
	},
	HALFLIGHT_PRIVATE_MUSIC_BUCKET: {
		schema: optional,
		description: 'Optional isolated S3-compatible bucket for owner-uploaded private music files.'
	},
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_ENDPOINT: {
		schema: optional,
		description: 'Optional S3-compatible endpoint for the private music bucket.'
	},
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_REGION: {
		schema: optional,
		description: 'Optional S3 region for the private music bucket. Defaults to auto.'
	},
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_ACCESS_KEY_ID: {
		schema: optional,
		description: 'Server-only access key for the private music bucket.'
	},
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_SECRET_ACCESS_KEY: {
		schema: optional,
		description: 'Server-only secret key for the private music bucket.'
	},
	HALFLIGHT_TIDAL_CACHE_BUCKET: {
		schema: optional,
		description:
			'Optional isolated S3-compatible bucket for short-lived completed TIDAL HiRes assemblies.'
	},
	HALFLIGHT_TIDAL_CACHE_ENABLED: {
		schema: optional,
		description:
			'Explicit opt-in for the short-lived TIDAL HiRes cache. Set only after provider permission and bucket lifecycle deletion are verified.'
	},
	HALFLIGHT_TIDAL_CACHE_BUCKET_ENDPOINT: {
		schema: optional,
		description: 'Optional S3-compatible endpoint for the short-lived TIDAL cache bucket.'
	},
	HALFLIGHT_TIDAL_CACHE_BUCKET_REGION: {
		schema: optional,
		description: 'Optional S3 region for the short-lived TIDAL cache bucket. Defaults to auto.'
	},
	HALFLIGHT_TIDAL_CACHE_BUCKET_ACCESS_KEY_ID: {
		schema: optional,
		description: 'Server-only access key for the short-lived TIDAL cache bucket.'
	},
	HALFLIGHT_TIDAL_CACHE_BUCKET_SECRET_ACCESS_KEY: {
		schema: optional,
		description: 'Server-only secret key for the short-lived TIDAL cache bucket.'
	},
	LASTFM_API_KEY: { schema: optional, description: 'Last.fm API key.' },
	TASTE_WORKER: {
		schema: optional,
		description:
			'Background playlist analysis for taste profiles. On by default in production builds and off in `vite dev`; set to `on` or `off` to override.'
	},
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
