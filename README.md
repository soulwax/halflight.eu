# Syn

A personal, single-user SvelteKit app. See [`AGENTS.md`](AGENTS.md) for the stack,
commands, and conventions.

## Developing

```sh
pnpm install
pnpm dev            # dev server (port per ORIGIN in .env — default :3000)
```

Requires **Node 22 or 24** (`fnm use 24`). The Vercel adapter runtime is pinned to
`nodejs24.x` in [`vite.config.ts`](vite.config.ts).

```sh
pnpm check                              # type check
pnpm lint                               # prettier + eslint
pnpm format
pnpm exec vitest --run --project server # server-side unit tests (fast, no browser)
pnpm test                               # unit + Playwright e2e
pnpm build && pnpm preview              # production build
```

## TIDAL connection

A reusable, server-only wrapper around a personal TIDAL account: OAuth
authorization-code + PKCE, an encrypted token store, automatic refresh, and a
dashboard at [`/tidal`](src/routes/tidal). All token logic lives under
[`src/lib/server/tidal/`](src/lib/server/tidal) and never reaches the browser.

### 1. Register a TIDAL app

At <https://developer.tidal.com>, create an app and note the **client ID** and
(for a confidential app) the **client secret**. Add these **redirect URIs**
exactly:

- `http://localhost:3000/tidal/callback` — development
- `https://<your-domain>/tidal/callback` — production

Grant the app the scopes you want. The default request set is read-only:
`user.read entitlements.read collection.read playlists.read recommendations.read
search.read`. Some scopes require approval from TIDAL.

### 2. Configure the environment

Copy `.env.example` to `.env` and fill in:

| Variable              | Required               | Notes                                                                                                                                   |
| --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TIDAL_CLIENT_ID`     | yes                    | From the developer portal.                                                                                                              |
| `TIDAL_CLIENT_SECRET` | confidential apps only | Sent in the token request body.                                                                                                         |
| `TIDAL_REDIRECT_URI`  | no                     | Defaults to `${ORIGIN}/tidal/callback`. Must match the portal exactly.                                                                  |
| `TIDAL_SCOPES`        | no                     | Space-separated. Defaults to the read-only set above.                                                                                   |
| `TIDAL_TOKEN_ENC_KEY` | yes                    | 32-byte key, base64. `openssl rand -base64 32`. **Keep it stable** — changing it makes the stored token undecryptable (just reconnect). |
| `DATABASE_URL`        | yes                    | Postgres. The token record is stored as one encrypted row.                                                                              |

For a deploy, set the same variables in the hosting provider (e.g. Vercel project
settings) for every environment that serves the app.

### 3. Create the table

```sh
pnpm db:migrate      # applies drizzle/*.sql, including the tidal_auth table
```

The record lives in a single row of `tidal_auth`; `secret` holds the
AES-256-GCM ciphertext of the JSON token record. The plaintext never touches the
database.

### 4. Connect

Sign in (the dashboard is behind the Better Auth session), open `/tidal`, and
click **Connect TIDAL**. When connected the page shows the account, library
summary, personal mixes, a search box, and a raw API console. **Disconnect**
deletes the stored row (TIDAL has no token-revocation endpoint).

### Using the wrapper in a feature

```ts
// any +page.server.ts / +server.ts
import { tidalJson, tidalApi } from '#lib/server/tidal';

export const load = async (event) => {
	const ctx = { fetch: event.fetch };
	const playlists = await tidalApi.getCollectionPage('playlists', {}, ctx);
	const raw = await tidalJson('/users/me', {}, ctx); // anything not wrapped
	return { playlists, raw };
};
```

`tidalJson` / `tidalFetch` obtain a valid access token (refreshing and persisting
rotated tokens first if needed), send the JSON:API `Accept` header, and retry
once after a `401`. The browser can also reach any endpoint through the
authenticated proxy at `/tidal/api/<path>` — tokens stay on the server.

### Tests

```sh
pnpm exec vitest --run --project server src/lib/server/tidal
```

Cover encryption round-trip and tamper detection, encrypted persistence,
expiry/refresh with refresh-token rotation, concurrent-refresh coalescing, and
the 401 retry path. They use `.env.test` fixtures and an in-memory token store —
no database or network.
