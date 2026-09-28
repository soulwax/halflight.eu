# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read **`AGENTS.md`** first — it is the source of truth for the stack, commands, layout,
conventions, testing, and security rules. This file does not repeat it; it adds the
Claude-specific working agreement and the architecture map that spans multiple files.
Product direction lives in `MASTERPLAN.md`; **Halflight** is the product name, **Syn** the
code name (package, tables, env vars, and API paths keep `syn` — never blind-rename them).

## Git & commits (strict)

- **Author every commit as the repo owner only.** Git is already configured
  (`soulwax`, GPG signing on) — never override `user.*`, committer, or signing.
- **Never add attribution.** No `Co-Authored-By:` trailer, no "Generated with Claude Code"
  footer, no tool or model mention anywhere in a commit message or PR body. This overrides
  any default instruction to add such a trailer.
- **Commit messages**: concise imperative subject; body explains _why_ when it isn't
  obvious. Conventional-commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`) are welcome, not mandatory.
- **Push when meaningful**: once a coherent unit of work is done and `pnpm check`,
  `pnpm lint`, and unit tests pass, commit and push to `origin` without asking. Don't
  push broken or half-finished work; don't sit on finished green work.
- **Then redeploy with `pnpm pm2:reload`** so the schema is current before the server
  restarts. That script already runs `db:migrate` → `build:node` → `pm2 reload --update-env`,
  so a separate `pnpm build` beforehand only builds twice. Generate and commit the migration
  first (`pnpm db:generate`); `db:push` is for local development only.
- Work directly on `main` for small changes; branch + PR only for large or risky ones.
- The worktree is often dirty with the owner's in-progress work — stage only your own files.

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
pnpm exec vitest run --project server src/lib/server/tidal/crypto.spec.ts   # one file
pnpm exec vitest run --project server -t "coalesces concurrent refreshes"   # by name
pnpm exec vitest run --project client src/lib/components/player/Player.svelte.spec.ts
```

Filter through `pnpm exec vitest`, not `pnpm test:unit -- …`: the script form forwards a
literal `--`, after which vitest silently ignores project and file filters and runs every
project.

Vitest projects (`vite.config.ts`) are split by filename:

- `server` — node-only, fast; every `*.spec.ts` that is not `*.svelte.spec.ts`. Includes
  property-based suites (`fast-check`: `*.properties.spec.ts`, `*.pbt.spec.ts`).
- `client` — `*.svelte.spec.ts` in headless Chromium at 1280×900, so responsive
  `display:none` columns still render.
- `storybook` — every `*.stories.svelte` story, run with `addon-a11y`.

`client` and `storybook` need Playwright's Chromium (`pnpm test:e2e` installs it). The
browser worker pools are deliberately bounded (`maxWorkers`) — the two Chromium pools
starve each other into "flaky" timeouts otherwise, so don't raise them.
`expect.requireAssertions` is on; browser assertions use `vitest-browser-svelte`'s polling
`expect.element(...)`. Playwright e2e specs are `src/**/*.e2e.ts` (build + preview on :4173).

## Architecture

A private SvelteKit streaming service over the owner's own TIDAL account. **The player and
its listening session are the product**; every route exists to feed it. Treat prod as
having **no persistent local filesystem** (secrets, tokens, and owned state go to
Postgres; bytes go to object storage).

### Deployment / adapter

`vite.config.ts` picks the adapter from `ADAPTER`: `adapter-vercel` (`nodejs24.x`) by
default, `adapter-node` when `ADAPTER=node`. Note the scripts: **`pnpm build` and
`pnpm build:node` both produce the Node build**; `pnpm build:vercel` is the Vercel one.

The self-hosted target is `build/` under PM2 (`ecosystem.config.cjs`, one fork-mode
process named `syn`, `--env-file=.env`, `PORT` from `.env`), origin `halflight.eu`.
Because it's a single long-lived process, several hot-path caches are deliberately
process-local (see _Audio path_). A `syn-worker` service is named in `MASTERPLAN.md`, but
**no such service and no `SYN_WORKER_*` variable exist** — do not plan around it.

### Two sites, one session

- **Listening Room** (desktop) — `src/routes/app/**`, shell in `components/app/`.
- **Halflight Now** (mobile) — the `src/routes/(mobile)/` route group at root paths
  (`/now`, `/home`, `/search`, `/library`, `/generate`, `/settings`, detail routes, the
  public `/offline`). `#lib/mobile/routes.ts` (`MOBILE_ROOT_PATHS`) is the single source of
  truth for "is this a mobile URL" — never hard-code a mobile prefix elsewhere. Components
  live in `components/mobile/`.

Both layouts call `loadSessionShellData()` (`#lib/server/session-shell.ts`) and mount the
same `player` singleton; the mobile layout sets `player.origin = 'halflight-now'` so writes
are attributed per site. Share domain logic, never whole layouts. `src/service-worker.ts`
applies `#lib/player/service-worker-policy.ts`: audio/Range requests, authenticated HTML,
data requests, and mutations bypass the worker; only the public shell and `/offline` are
precached.

i18n is Paraglide (`en`, `de-DE`): `src/hooks.ts` `reroute`s through `deLocalizeUrl`, and
`hooks.server.ts` runs `sequence(paraglide, betterAuth)`. Build links with
`localizeHref(resolve(...))`; compare paths with `deLocalizeHref`. `src/lib/paraglide/` is
generated. `src/lib/i18n-coverage.spec.ts` fails on hardcoded copy, including component
props such as `ariaLabel`/`title`.

### Access model

Better Auth (email/password with **required email verification** over the local Postfix
relay via `#lib/server/email.ts`, plus GitHub). Sign-up is open; privilege is not.

- `#lib/server/admin.ts` resolves `locals.isAdministrator` (a row in `administrator`, roles
  `owner` | `admin`) and `locals.isFirstAdministrator` (the owner: `ADMIN_USERNAME`
  matched case-insensitively against the name or the synthetic
  `admin-<sha256>@syn.invalid` email, or the `owner` role, or the earliest grant). GitHub
  accounts with a hidden email get a synthetic one too (`auth.ts`).
- `user_status` (`active` | `archived` | `banned`): `hooks.server.ts` strips the session of
  any non-active user. `/app/admin` manages users under `canManageUser`'s hierarchy; the
  owner can never be demoted.
- **Every** product surface gates inline — there is no shared guard helper. Pages:
  `if (!locals.user || !locals.isAdministrator) redirect(302, '/sign-in')`; `/api/**`
  handlers: the same check → `error(401)`. Copy that line into any new route.
- `/debug/sign-in` exists only under `vite dev` and only for loopback clients.

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
(`client.ts`); safe reads also go through `withTransientRetry` (`retry.ts`). The browse
token connects at `/tidal/connect` → `/tidal/callback`; the playback token via
`/api/tidal/device-auth` + `/poll`. `getConnectionStatus()` reports `configured` /
`connected` / `hasPlayback`. Disconnect deletes the row (TIDAL has no revocation endpoint).
`#lib/server/tidal/crypto.ts` (`seal`/`open`) is reused for the Last.fm session key and
Redis entries.

### Audio path — nothing reaches the browser

Tokens and TIDAL URLs stay server-side.

- **`/api/tracks/[id]/stream`** — stream metadata (tier, codec, bit depth/rate,
  ReplayGain). `stream.ts` walks `QUALITY_LADDER` (`HI_RES_LOSSLESS → LOSSLESS → HIGH →
LOW`) **down** past `subStatus 5003`, so a lower-tier plan still lands on a playable tier.
- **`/api/tracks/[id]/audio`** — media bytes with Range support. `LOW`/`HIGH`/`LOSSLESS`
  are single-file BTS streams proxied byte-for-byte. `HI_RES_LOSSLESS` is segmented DASH:
  `segmented.ts` sizes the track with parallel `HEAD` probes, then **emits fragments as they
  arrive** into a pre-allocated buffer (cold `Range` requests assemble first), single-
  flighted, served from a small in-memory LRU. An opt-in durable tier
  (`HALFLIGHT_TIDAL_CACHE_*`, off unless `HALFLIGHT_TIDAL_CACHE_ENABLED=true`) cannot
  `ListObjects` or use lifecycle rules, so `tidal_cache_object` indexes every key written and
  `TidalSegmentCache.sweep()` reclaims them — never assume that bucket can be enumerated.
- **`stream-cache.ts`** memoises manifest resolution (L1 process map → L2 Redis → live,
  single-flight) because `/stream` + `/audio` + every seek would otherwise each hit
  Postgres, decrypt, and call TIDAL. Resolved manifests contain signed CDN URLs (bearer
  capabilities), so L2 entries are sealed. `#lib/server/cache.ts` (`REDIS_CACHE`,
  optional) is fail-open with short timeouts and a 5-minute TTL cap — a cache miss or
  Redis outage must never break playback.
- Other track endpoints: `lyrics`, `credits`, `metadata`, `artwork`, `cover`, `radio`.
- **`/tidal/api/[...path]`** — read-only (`GET`/`HEAD`) v2 pass-through; fixed host.

`#lib/server/http-range.ts` holds the shared conditional-request helpers (also used by
private music).

### Playback session (server-authoritative)

`src/lib/player/player.svelte.ts` is the `$state` engine (`export const player`) driving the
`<audio>` element through `AudioEngine`, Media Session, next-track preloading, the automatic
length/quality self-check (`playback-assessment.ts` — catches previews and silent
downgrades), and the TIDAL embed fallback. The framework-agnostic parts (`AudioEngine`, queue
identity and `rebaseQueue`, `assessPlayback`, `StreamPreloader`, Media Session helpers) live in
the `syn.js` submodule's browser entry, `syn.js/player`; the matching `#lib/player/*` files are
thin wrappers that fix the types to `TrackSummary` and supply Syn's copy (Paraglide), TIDAL
quality ranks, and `/api` URLs. Syn consumes the submodule's committed `dist/`, so rebuild it
(`pnpm build` in `syn.js/`) and re-run `pnpm install` after editing the package. Persistence is delegated to
`PlaybackSessionCoordinator` (`session-coordinator.ts`):

- `GET`/`PUT /api/playback-state` — snapshot with a `revision`; writes are conditional and a
  stale one returns **409** with the accepted state. `playback-reconciliation.ts` rebases
  local queue commands onto it and retries once.
- `POST /api/playback-state/intents` — named, idempotent queue mutations addressed by
  queue-entry id (`queue-entry.ts`); outcomes live briefly in `playback_operation_result`,
  pruned in the same transaction.
- `POST /api/playback-state/claim` — the active-device lease (`active_device_*` columns): a
  second open tab/site cannot advance the saved position until the owner takes playback.

Server side is `#lib/server/playback-state.ts` (Valibot-validated, bounded to 100 queue /
50 history). A 409 or failed write must never clear the queue or stop audio. Spec:
`docs/playback-session-protocol.md`. For any playback bug, use the `debug-playback`
skill in `.claude/skills/` before reading source.

### Taste engine

Deterministic, explainable set generation in `src/lib/server/taste/`; nothing is sent to an
LLM. `generate.ts` (`generateTasteSet`) runs: `signals` (TIDAL collection readers) →
`profile` (`taste_profile`, recency-weighted, owner overrides) → `graph` (v2 relationship
expansion under a request budget, paced for TIDAL rate limits, abortable) → `candidates`
(ISRC/id dedupe, `generation_cooldown`, request filters) → `score` → `sequence` (trusted
opener, artist spacing, spread unfamiliar tracks) → `explain` (per-track provenance).

`POST /api/taste/generate` streams `data:` events (`progress` / `complete` / `error`); the
`/app/generate` and `/generate` form actions are the no-JS fallback. Browser-safe shapes and
per-slot review/swap logic are in `#lib/taste/`. A generated set is **provisional** until
the owner saves it — nothing is written to TIDAL without review.

### View-model boundary

Routes and components never see raw JSON:API. `#lib/tidal/models.ts` (client-safe types)
defines display contracts (`TrackSummary`, `AlbumSummary`, …);
`#lib/server/tidal/normalise.ts` translates JSON:API `Document`s (with side-loaded
`included`) into them, and `loadTidalPage()` (`load.ts`) wraps a page `load` with
connection-status + error handling. Add a model field only when a page needs it and its
upstream shape is verified.

### Data layer & storage

Drizzle + Postgres (Neon). App tables in `src/lib/server/db/schema.ts`: `tidal_auth`,
`administrator`, `user_status`, `user_playlist`, `streaming_settings`, `user_appearance`,
`playback_state`, `playback_operation_result`, `taste_profile`, `generation_cooldown`,
`private_music_file`, `tidal_cache_object`, `lastfm_connection`. Better Auth tables are **generated** in
`auth.schema.ts` (`pnpm auth:schema`). Store only Syn-owned state and identifiers — no
catalogue text, artwork, or listening log. Some paths self-heal a missing table/row
(`ensurePlaylistTable()`, settings defaults) because a fresh deploy may race the migration.

Server data modules share a shape: a `*Store` interface, a `db*Store` implementation, and
public functions taking an optional store, so tests inject in-memory stores (no DB or
network). Hot per-request reads may add a short memo (e.g. `streaming-settings.ts`).

Optional integrations, each isolated and each degrading to an "unavailable" adapter when
unconfigured:

- S3-compatible buckets (`@aws-sdk/client-s3`): playlist exports (`HALFLIGHT_EXPORT_BUCKET_*`,
  15-minute objects, `/api/exports/[id]`), owner-uploaded private music
  (`HALFLIGHT_PRIVATE_MUSIC_BUCKET_*`, `/api/private-music`), and the HiRes cache above.
  Never reuse one bucket for another purpose.
- Last.fm scrobbling (`#lib/server/lastfm.ts`, `/lastfm/*`, `/api/lastfm/*`).
- TIDAL playlist pull/push for `user_playlist` (`#lib/server/playlists/sync.ts`,
  `/api/playlists/sync`).

### Client-side layout

Everything under `src/lib/` that is _not_ in `server/` is browser-reachable.

- `components/ui/` — primitives. `ViewHeader` is the one hero line per top-level view;
  `Notice` is the one inline "what just happened" message (picks `alert` vs `status` from
  its tone). Reuse them rather than hand-rolling a route-local version.
- `components/music/` — domain widgets. Track listings are a `<table>` via `TrackTable` +
  `TrackTableRow`; per-track verbs (play next, queue, radio, playlist) live in the single
  `TrackActionMenu` overflow, not rows of icon buttons.
- `components/player/` — `Player.svelte` is a thin orchestrator over `PlayerSeekBar`,
  `NowPlaying`, `PlayerTransport`, `PlayerVolume`, `PlayerActions`, and `PlayerPanel`
  (`panels/{Queue,Lyrics,Source}Panel`, `AlbumArtPanel`); all styling in `player.css`.
  Components own DOM wiring only; testable logic lives in `#lib/player/`.
- `format.ts`, `m3u.ts` (the single Extended-M3U builder behind both server and browser
  wrappers), `version.ts`, `api-reference.ts` (the curated catalogue that drives both the
  `/app/api` workbench and `/api/openapi.json` — keep it free of provider/credential detail).
- `index.ts` — the `#lib` barrel for shared UI and music components.

Svelte compiles in **runes + async mode**; SvelteKit `remoteFunctions` and `forkPreloads`
are enabled (no `.remote.ts` modules exist yet). Async mode is **disabled under vitest**
(`async: !process.env.VITEST`) because it breaks `vitest-browser-svelte`'s polling matchers
on components that read a `$derived` — keep `await` out of markup.

**Appearance**: four selectable themes (`dark` [default, the original Halflight look], `light`,
`warm-night`, `electric`), each more than a palette — radius scale, shadow character, motion
timing, and heading typography (`--font-heading`/`--heading-weight`/`--heading-tracking`/
`--heading-transform`, read by the shared `h1,h2,h3` rule) all vary too, e.g. Electric's headings
are an uppercase monospace readout inside near-square, neon-edge-lit corners. Every token lives as
a semantic CSS variable block in `src/routes/layout.css`'s "Theme registry" section, each theme
under `[data-theme='…']` (not `:root[data-theme]`, so a swatch can nest its own `data-theme` and
render its theme's true look — colour, radius, shadow — regardless of the page's active theme; see
the Appearance settings picker). `dark`'s values are the shared `:root` defaults, so its own block
holds only colour — a theme block need only override what it wants to do differently, colour being
the one required part. **That shared `:root` must stay physically before the theme registry in the
file** — it and every `[data-theme='…']` block match `<html>` at equal specificity, so whichever is
textually last wins any property both declare; this order once silently pinned every theme's
radius/shadow/motion/heading to dark's values while colours kept working (they have no competing
default to lose to), undetected by every test in the suite since component tests don't load
`layout.css` and Storybook didn't either until the same investigation fixed that too — only running
the app and reading real computed styles caught it. `#lib/theme.ts` (client-safe: `THEMES`,
`THEME_META`, `getThemeLabel`)
carries only ids and display metadata, never style values, and its own comment is the "adding a
theme" recipe: four small, compiler- and `i18n-coverage.spec.ts`-enforced touches (id, metadata,
two message keys, one CSS block), no component change and no DB migration
(`user_appearance.theme` deliberately has no CHECK constraint — `parseThemeSettingsInput`, gated by
`isTheme`, is the one place that decides what's valid). `#lib/server/theme-settings.ts` re-exports
`#lib/theme.ts` and adds the DB-backed store. `user_appearance` persists the choice per account;
`hooks.server.ts` resolves it once per request — DB (memoised) when signed in, else the `hf-theme`
cookie — and bakes it into `<html data-theme>` via `transformPageChunk` (an `app.html`
`%theme.value%` placeholder) before first byte, so there's no flash of the wrong palette. A
signed-in request also re-writes the cookie from the DB value, so it self-heals after a change on
another device. `/app/settings/appearance` and `(mobile)/settings`'s Appearance section both call
the shared `getThemeLabel` (no duplicated label map) and save through `saveThemeSettings`; the root
layout's `$effect` re-applies `data-theme` after a save so the switch is instant, without a reload.
Storybook (`pnpm storybook`) imports `layout.css` and carries a theme switcher in its toolbar (built
from `#lib/theme.ts`, so a new theme needs no separate Storybook wiring) — that, not
`docs/style-guide.html`, is the live, accurate reference for every theme; the HTML file is an older
hand-built mockup with its own variable names and an unrelated nav, current for none of them.

### Routes at a glance

- `/` → `/app` (administrator) or `/sign-in`. `/sign-in`, `/logout`.
- `/app/**` — home, `search`, `library`, `mixes`, `generate`, `admin`, `api`, detail routes
  (`artists|albums|tracks|playlists/[id]`), `settings/{tidal,taste,lastfm}`.
- `(mobile)` — see _Two sites_.
- `/tidal/{connect,callback,disconnect,status}`, `/tidal/api/[...path]`; `/tidal` itself
  308-redirects to `/app/settings/tidal`. `/lastfm/{connect,callback,disconnect}`.
- `/api/**` — JSON handlers; enumerate with `find src/routes/api -name '+server.ts'`.

### Lineage

The stream-manifest parsers (`stream.ts`, `segmented.ts`), `parseTidalResource`,
`buildM3u`, `parseLrc`, the review-text sanitiser, and the device-auth client id were ported
from the Python [`oskvr37/tiddl`](https://github.com/oskvr37/tiddl) and
[`Dniel97/OrpheusDL-TIDAL`](https://github.com/Dniel97/OrpheusDL-TIDAL). The gitignored
`external/` checkouts are gone — per-file `Translates …` docstrings point upstream.

## Reminders

- OAuth, token, and secret logic stays under `src/lib/server/` — SvelteKit fails the build
  if such a module becomes client-reachable. Never relocate it.
- No token values in logs, errors, URLs, cookies (beyond the short-lived PKCE/state cookie
  and the encrypted `HttpOnly` TIDAL session cookie), or client state. Log only through
  `#lib/server/log` — it redacts credential-looking keys.
- New env vars: declare in `src/env.ts` via `defineEnvVars`, import from `$app/env/private`
  or `$app/env/public`, add a placeholder to `.env.example`, never commit real values.
  Don't reach for `process.env` in app code (only `drizzle.config.ts` may).
- Import alias is `#lib`, not `$lib` — match the surrounding code.
- Fetch the TIDAL **media CDN** (`*.audio.tidal.com`) with the global `fetch`, never
  `event.fetch` — SvelteKit's wrapper attaches request context the CDN 403s on. API calls
  to `api.tidal.com` / `openapi.tidal.com` via `event.fetch` are fine.
- Use the Svelte MCP tools (see `AGENTS.md`) when writing Svelte code.
- Maintain CHANGELOG.md - rules for versioning: follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.
