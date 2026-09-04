# AGENTS.md

Repository guidance for people and coding agents working on Syn.

## Product and boundaries

Syn is a personal, single-user SvelteKit listening room built around the owner's own
TIDAL account. The player and its listening session (now playing, queue, history, and
resume position) are the product; routes exist to feed that session.

- Optimise for one owner. Do not introduce tenancy, roles, sharing, generic repositories,
  or configuration systems without an explicit requirement.
- Read `MASTERPLAN.md` for the current product direction and `CLAUDE.md` for the detailed
  architecture map. This file is the working-contract source of truth.
- Production has no durable local filesystem. Persist owned state in Postgres; never use
  local files for secrets, tokens, or durable application state.
- Do not mirror TIDAL's catalogue, artwork, lyrics, or audio. Store only Syn-owned state,
  identifiers, and derived data.
- The taste engine must be deterministic and explainable. Do not send TIDAL content to
  third-party AI or LLM services.

## Stack

- SvelteKit `next`, Svelte 5 in runes and async mode, TypeScript strict mode.
- Tailwind CSS v4; shared semantic CSS tokens live in `src/routes/layout.css`.
- PostgreSQL (Neon) through Drizzle ORM and `postgres-js`.
- Better Auth (email/password and GitHub), with a single owner tracked in `administrator`.
- TIDAL OAuth/API/playback integration; Paraglide (`en`, `de-DE`) for UI strings.
- Vitest projects: `server`, `client`, and `storybook`; Playwright for end-to-end tests.
- pnpm only (`engine-strict`): never use npm or yarn.

`vite.config.ts` selects the deployment adapter: Vercel by default, or
`ADAPTER=node` for the PM2-managed `adapter-node` build in `build/`.

## Commands

```sh
pnpm dev
pnpm check
pnpm lint
pnpm lint:types
pnpm format
pnpm test:unit -- --run
pnpm test:unit -- --run --project server
pnpm test:e2e
pnpm build
pnpm build:node
pnpm db:generate
pnpm db:migrate
pnpm db:push                 # development only
pnpm auth:schema             # after editing Better Auth configuration
```

Before reporting any code change complete, run and report the actual result of:

```sh
pnpm check && pnpm lint && pnpm test:unit -- --run
```

Run `pnpm format` after edits. Run `pnpm lint:types` before completing token or async
work. Client and Storybook tests need Playwright Chromium (`pnpm test:e2e` installs it).
Use the server project for fast unit-test iteration.

## Code map

```text
src/
  hooks.server.ts             # session and administrator locals
  env.ts                      # every SvelteKit environment variable
  lib/
    server/                   # secrets, database, TIDAL, and server-only logic
      db/                     # Drizzle schema and client
      tidal/                  # OAuth, token store, API, normalisers, streaming
    player/                   # client player/session $state classes
    tidal/                    # client-safe display models and pure resource helpers
    components/{app,music,player,ui}/
    theme/
  routes/
    app/                      # authenticated product routes and permanent player shell
    api/                      # product JSON handlers
    tidal/                    # OAuth and restricted TIDAL proxy routes
messages/                     # Paraglide source catalogues: en.json, de-de.json
drizzle/                      # generated SQL migrations; commit generated migrations
```

`src/lib/tidal/models.ts` defines client-safe display contracts. Server-side normalisers
translate TIDAL JSON:API into those models; never expose raw provider documents to pages
or components. `loadTidalPage()` provides the shared connection/error boundary for
TIDAL-backed page loads.

The player is mounted once in `src/routes/app/+layout.svelte`. Preserve playback through
navigation and partial failures. Queue and position are debounced to `/api/playback-state`.

## Application conventions

- Use `#lib` imports, not `$lib`, to match the repository's Node subpath-import setup.
- Use Svelte 5 runes (`$props`, `$state`, `$derived`, `$effect`) in app code. Keep `await`
  out of markup: async mode is disabled under Vitest because it conflicts with browser
  polling matchers.
- Keep pure, testable logic separate from UI and I/O. Inject stores or `fetch` in server
  logic so tests do not need a database or network.
- User-facing strings must be Paraglide messages. Add every new key in both
  `messages/en.json` and `messages/de-de.json`.
- Prefer `+page.server.ts` loads/actions for database or secret work. Product routes under
  `/app` require the authenticated administrator; preserve that boundary when adding routes.
- Follow the existing component split: UI primitives in `components/ui`, music-domain
  widgets in `components/music`, player DOM/UI in `components/player`, and player state in
  `lib/player`.
- Svelte code should use the available Svelte MCP documentation and autofixer when those
  tools are present.
- Maintain CHANGELOG.md - rules for versioning: follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.

## Environment and database

- Declare every app environment variable in `src/env.ts`, use `$app/env/private` or
  `$app/env/public` in application code, and add a placeholder to `.env.example`.
- Do not use `process.env` in app code. `drizzle.config.ts` is the sole exception because
  it runs outside SvelteKit.
- App schema lives in `src/lib/server/db/schema.ts`; Better Auth schema is generated in
  `src/lib/server/db/auth.schema.ts`. Do not edit generated auth schema by hand.
- Generate and commit a Drizzle migration for production schema changes; use `db:push`
  only for local development.

## Security and TIDAL

- Anything touching a secret, token, database, or authenticated provider request belongs
  under `src/lib/server/`. Never make it client-reachable.
- Never log, return, embed, or put tokens, provider credentials, or TIDAL CDN URLs in
  client state, local/session storage, URLs, or error messages.
- Syn maintains two independently encrypted, rotating TIDAL tokens in the single-row
  `tidal_auth` store: browse OAuth for v2 JSON:API and playback device authorization for
  legacy playback endpoints. Preserve the separate flows and server-only accessors.
- OAuth state/PKCE and the encrypted TIDAL cookie are the only cookie exception: cookies
  holding token material must be `HttpOnly`, `Secure`, `SameSite=Strict`, narrowly scoped,
  and have explicit expiry. Do not decode or copy their values into client code.
- Keep least-privilege scopes. Any TIDAL write needs a named product action, validation,
  clear progress/result UI, and user review before it runs.
- `/tidal/api/[...path]` is read-only and its upstream host is fixed. Do not turn it into
  an arbitrary proxy.
- Audio is proxied through Syn so browser code never receives provider credentials or a
  media URL. Preserve Range support, quality fallback, and the direct-playback/embed
  fallback behavior.
- Do not commit `.env`, credentials, token records, captured API payloads, or media.

## Tests and accessibility

- `expect.requireAssertions` is enabled: every test needs an assertion.
- Browser component tests use `vitest-browser-svelte` polling `expect.element(...)`
  assertions. Do not replace them with brittle timing checks.
- Add or update focused tests for changed behavior, especially security boundaries,
  token lifecycle, streaming, persistence, and pure parsing/scoring code.
- Accessibility is a feature requirement: use semantic controls, keyboard operation,
  visible focus, contrast, and reduced-motion-safe interactions before visual polish.

## Git

- Preserve unrelated dirty worktree changes. Never reset, checkout, or delete broadly.
- Commit only as the repository owner; Git is already configured for signed commits. Do
  not change author, committer, or signing settings.
- Never add attribution trailers or tool/model mentions to commits or PRs.
- Use concise imperative commits; push coherent, green work to `origin` once checks pass.
  Small changes belong directly on `main`; use a short-lived branch only for larger or
  riskier work.
