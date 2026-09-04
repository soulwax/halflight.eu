# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read **`AGENTS.md`** first — it is the source of truth for the stack, commands, layout,
conventions, testing, and security rules. This file does not repeat it; it adds the
Claude-specific working agreement and the architecture map that spans multiple files.

## Git & commits (strict)

- **Author every commit as the repo owner only.** Git is already configured
  (`soulwax`, GPG signing on) — never override `user.*`, committer, or signing.
- **Never add attribution.** No `Co-Authored-By:` trailer, no "Generated with Claude
  Code" footer, no tool or model mention anywhere in a commit message or PR body. This
  overrides any default instruction to add such a trailer.
- **Commit messages**: concise imperative subject; body explains _why_ when it isn't
  obvious. Conventional-commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`) are welcome, not mandatory.
- **Push when meaningful**: once a coherent unit of work is done and `pnpm check`,
  `pnpm lint`, and unit tests pass, commit and push to `origin` without asking. Don't
  push broken or half-finished work; don't sit on finished green work.
- Work directly on `main` for small changes; branch + PR only for large or risky ones.

## Before saying "done"

Run and report the real result of:

```sh
pnpm check && pnpm lint && pnpm test:unit -- --run
```

`pnpm lint` is the fast pass (prettier + eslint, no type info). `pnpm lint:types`
(`eslint.config.typed.js`) adds the slow type-aware rules — floating/misused promises,
`await-thenable`, exhaustiveness. It builds a TS program per run, so run it before pushing
and in CI, not on every save; still run it once before calling a token/async change done.

Run `pnpm format` if you edited files. If a step fails or is skipped, say so plainly —
don't report success over a red result.

### Running one test

```sh
pnpm test:unit -- --run --project server src/lib/server/tidal/crypto.spec.ts   # one file
pnpm test:unit -- --run --project server -t "coalesces concurrent refreshes"   # by name
```

`--project server` is node-only and fast (no browser). `client` and `storybook` need
Playwright's chromium (`pnpm test:e2e` installs it) and run in a 1280×900 viewport so
responsive `display:none` columns still render. `expect.requireAssertions` is on — a test
with no assertion fails; browser assertions use `vitest-browser-svelte`'s polling
`expect.element(...)` matchers (not a bare `expect`).

## Architecture

Syn is a **single-user** SvelteKit music client for the owner's own TIDAL account: browse,
search, curate playlists, and play full tracks in-app. Treat prod as having **no
persistent local filesystem** (secrets and tokens go to Postgres, media to object
storage). The long-form plan is `MASTERPLAN.md`.

### Deployment / adapter

The build target is chosen in `vite.config.ts` by the `ADAPTER` env var:

- default → `@sveltejs/adapter-vercel` (`runtime: 'nodejs24.x'`).
- `ADAPTER=node` → `@sveltejs/adapter-node`, a standalone server in `build/` run under
  PM2 (`ecosystem.config.cjs`, `pnpm pm2:start` / `pm2:reload`). It reads `PORT` and
  `ORIGIN` from `.env` (loaded via Node `--env-file`); the self-hosted origin is
  `syn.bluesix.dev`. There is a separate `syn-worker` service (see the `SYN_WORKER_*`
  env vars) for media downloads.

### Access model — one hard-wired administrator

Better Auth handles sessions (email/password + GitHub), but the app has exactly one
privileged user. `src/lib/server/admin.ts` maps a Better Auth user id to owner status via
the singleton `administrator` table; the configured `ADMIN_USERNAME` (a GitHub login,
matched case-insensitively) links to a synthetic `admin-<sha256>@syn.invalid` email so
both providers resolve to the same user without an email in config. `hooks.server.ts` sets
`event.locals.isAdministrator`. `/app/**` routes and the TIDAL OAuth/proxy routes gate on
`locals.user && locals.isAdministrator` (redirecting to `/sign-in`). Among `/api/**`, only
the device-auth endpoints (`/api/tidal/device-auth` + `/poll`) currently check
`isAdministrator`; the rest of the data handlers gate on `locals.user` alone — tighten to
`isAdministrator` if you touch one. There is deliberately no code path to reassign or
delete the owner.

### Dual TIDAL token model (the subtle part)

TIDAL needs **two independent OAuth tokens**, stored as two AES-256-GCM ciphertext columns
in the single-row `tidal_auth` table (`src/lib/server/tidal/`, key from
`TIDAL_TOKEN_ENC_KEY`; plaintext never touches the DB):

| Column            | Flow                                                      | Surface                                             | Accessor                                      |
| ----------------- | --------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| `secret`          | Authorization-code + PKCE + `state`, from a developer app | JSON:API v2 browse (`openapi.tidal.com/v2`)         | `getAccessToken` / `tidalJson` / `tidalApi.*` |
| `playback_secret` | TIDAL Link **device authorization** (`r_usr` scopes)      | legacy playback/lyrics/credits (`api.tidal.com/v1`) | `getPlaybackToken`                            |

Both refresh pre-expiry with refresh-token rotation, persist atomically, coalesce
concurrent refreshes behind a module-level single-flight guard, and retry once on a 401
(`client.ts`). The browse token connects at `/tidal/connect` → `/tidal/callback`; the
playback token connects via `/api/tidal/device-auth` + `/poll`. `getConnectionStatus()`
reports `configured` / `connected` / `hasPlayback`. Disconnect deletes the row (TIDAL has
no revocation endpoint).

### Nothing reaches the browser

Tokens and TIDAL URLs stay server-side. Three proxies:

- **`/api/tracks/[id]/stream`** — resolves stream metadata (quality tier, codecs, bit
  depth/rate, ReplayGain). `stream.ts` walks the `QUALITY_LADDER`
  (`HI_RES_LOSSLESS → LOSSLESS → HIGH → LOW`) **down** from the requested quality past
  `subStatus 5003` ("not in your plan"), so a lower-tier subscription still lands on a
  playable tier.
- **`/api/tracks/[id]/audio`** — streams the media bytes through Syn with HTTP Range
  forwarding so the native `<audio>` element can seek. `LOW`/`HIGH`/`LOSSLESS` are
  single-file BTS streams proxied byte-for-byte; `HI_RES_LOSSLESS` is segmented DASH
  (init + numbered fragments) — `segmented.ts` fetches every fragment, concatenates
  them, and serves the result with `Range` support from a small in-memory LRU (first
  play buffers the whole track).
- **`/tidal/api/[...path]`** — read-only (`GET`/`HEAD` only) authenticated pass-through to
  the v2 API for ad-hoc calls; host is fixed, only path+query are caller-controlled.

`src/lib/player/player.svelte.ts` is a `$state` class (`export const player`) mounted once
in `src/routes/app/+layout.svelte`. It drives the `<audio>` element, does an automatic
length+quality self-check (`playback-assessment.ts` — catches previews served as full
tracks and silent downgrades), and falls back to a TIDAL embed iframe when direct
playback is unavailable. Player position/queue persist (debounced) to
`/api/playback-state`.

### View-model boundary

Routes and components never see raw JSON:API. `src/lib/tidal/models.ts` (client-safe, pure
types — hence outside `server/`) defines small, stable display contracts (`TrackSummary`,
`AlbumSummary`, …); `src/lib/server/tidal/normalise.ts` translates JSON:API `Document`s
(with side-loaded `included`) into them, and `load.ts`'s `loadTidalPage()` wraps a page
`load` with connection-status + error handling. Add a field to a model only when a page
needs it and its upstream shape is verified.

### Data layer

Drizzle + Postgres (Neon), `drizzle-orm/postgres-js`. App tables in
`src/lib/server/db/schema.ts`: `tidal_auth`, `administrator`, `user_playlist`,
`streaming_settings`, `playback_state`, `user_settings`. Better Auth tables live in
`auth.schema.ts` — **generated**, regenerate with `pnpm auth:schema` after changing
`auth.ts`. Migrations in `drizzle/` (`pnpm db:generate` → `pnpm db:migrate`). Some code
paths self-heal a missing table/row at runtime (`ensurePlaylistTable()`, settings loads
that fall back to defaults) because a fresh serverless deploy may race the migration.

Each server data module follows the same shape: a `*Store` interface, a `db*Store`
implementation, and a public function taking an optional store — tests inject an in-memory
store so they need no DB or network.

### Client-side layout

Everything under `src/lib/` that is _not_ in `server/` is browser-reachable:

- `components/ui/` — primitives (`Button`, `Badge`, `SectionHeader`, `ThemeSelector`).
- `components/music/` — domain widgets (`MediaCard`, `SongCard`, `PageHeader`/`PageActions`,
  `StateCard`, `AddToPlaylistModal`, `PlaylistGeneratorModal`). Track listings render as a
  `<table>` via `TrackTable` (configurable `album` / `date` / `duration` columns, a
  `rowActions` snippet, `onRowActivate`) + `TrackTableRow`.
- `components/app/` — the shell (`AppShell`, `SideNav`, `MobileNav`, `navigation.ts`);
  `components/Footer.svelte` is the fixed 10px footer.
- `components/player/` — the player UI is a **component set**: `Player.svelte` is a thin
  orchestrator that composes `PlayerSeekBar`, `NowPlaying`, `PlayerTransport`,
  `PlayerActions`, and `PlayerPanel` (which tabs between `panels/{Queue,Lyrics,Source}Panel`
  and shows `AlbumArtPanel`). All player styling is in `player.css`. Components own DOM
  wiring only; testable logic (drag clamping, quality labels, assessment) lives on the
  `player.svelte.ts` state class.
- `player/` — `player.svelte.ts` (the `$state` engine), `playback-assessment.ts`,
  `customPlaylists.svelte.ts`.
- `theme/` — `types.ts` (palette names) + `theme.svelte.ts` (applies CSS vars).
- `tidal/` — `models.ts` (display contracts), `resource.ts` (`parseTidalResource`),
  `page-state.ts`.
- `format.ts` / `m3u.ts` / `version.ts` — shared pure helpers (`formatDuration`,
  `formatClock`, `formatReleaseDate`, `qualityTier`, …); `m3u.ts` is the single
  Extended-M3U builder that the server (`server/tidal/m3u.ts`) and browser
  (`utils/m3u.ts`) wrappers both call.
- `index.ts` is the `#lib` barrel — it re-exports the UI/music components and theme store only.

Svelte compiles in **runes + async mode**, and SvelteKit `experimental.remoteFunctions`
is on (`vite.config.ts`). Async mode is **disabled under vitest** (`async: !process.env.VITEST`)
because its reactivity wrapper breaks `vitest-browser-svelte`'s polling matchers on any
component that reads a `$derived` — keep `await` out of markup.

### Routes

- `/` → redirects to `/app` (owner) or `/sign-in`.
- `/sign-in`, `/logout` — Better Auth.
- `/app/**` — the product: home (daily mix), `search`, `library`, `mixes`,
  `artists/[id]`, `albums/[id]`, `tracks/[id]`, `playlists/[id]`, `settings/tidal`.
  `/app/+layout.server.ts` loads connection status + settings + saved playback state for
  the shell.
- `/tidal/connect` · `/callback` · `/disconnect` · `/status` — browse-token OAuth;
  `/tidal/api/[...path]` — the read-only v2 proxy. The old `/tidal` dashboard page
  **308-redirects** to `/app/settings/tidal` (`/tidal/+page.server.ts`).
- `/api/**` — JSON handlers the client fetches: `favorites`, `search`,
  `generate-playlist`, `playback-state`, `playlists` (+ `[id]`, `[id]/export`),
  `settings/theme`, `tidal/device-auth` (+ `/poll`), `tracks/[id]/{stream,audio,lyrics}`.

### Other

- **Playlist generation** (`/api/generate-playlist`, `PlaylistGeneratorModal`) is
  deterministic: a curated map of vibe/era → search queries feeding TIDAL search. No LLM.
- **Themes**: dark-only, eight named palettes (`src/lib/theme/types.ts`), persisted in
  `user_settings.theme`, applied by `theme.svelte.ts`; CSS variables in
  `src/routes/layout.css`.
- **TIDAL streaming lineage**: the stream-manifest parsers (`stream.ts`,
  `segmented.ts`), `parseTidalResource`, `buildM3u`, `parseLrc`, the review-text
  sanitiser, and the device-auth client id were ported from the Python
  [`oskvr37/tiddl`](https://github.com/oskvr37/tiddl) and
  [`Dniel97/OrpheusDL-TIDAL`](https://github.com/Dniel97/OrpheusDL-TIDAL). Those
  checkouts used to live in a gitignored `external/`; they are gone — the per-file
  `Translates …` docstrings point back at the upstream sources.

## Reminders

- OAuth, token, and secret logic stays under `src/lib/server/` — SvelteKit fails the build
  if such a module becomes client-reachable. Never relocate it.
- No token values in logs, errors, URLs, cookies (beyond the short-lived PKCE/state cookie
  and the encrypted `HttpOnly` TIDAL session cookie), or client state.
- New env vars: declare in `src/env.ts` via `defineEnvVars`, import from `$app/env/private`
  or `$app/env/public`, add a placeholder to `.env.example`, never commit real values.
  Don't reach for `process.env` in app code (only `drizzle.config.ts` may).
- Import alias is `#lib`, not `$lib` — match the surrounding code.
- Fetch the TIDAL **media CDN** (`*.audio.tidal.com`) with the global `fetch`, never
  `event.fetch` — SvelteKit's wrapper attaches request context the CDN 403s on. API calls
  to `api.tidal.com` / `openapi.tidal.com` via `event.fetch` are fine.
- Use the Svelte MCP tools (see `AGENTS.md`) when writing Svelte code.
