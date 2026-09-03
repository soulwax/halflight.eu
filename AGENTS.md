# AGENTS.md

Guidance for anyone — human or AI agent — working in this repository.

## What this is

**Syn** is a **personal, single-user** SvelteKit app. It is not a multi-user product:
favour simple, direct solutions over generalised abstractions and configuration. The
current focus is a durable OAuth token foundation for connecting the owner's own TIDAL
account (see `CLAUDE.md` and the TIDAL plan).

## Stack

- **Framework** — SvelteKit (experimental `next`), Svelte 5; runes mode is forced on for
  app code.
- **Language** — TypeScript, `strict`, `rewriteRelativeImportExtensions`.
- **Package manager** — pnpm (`engine-strict`); do not use npm or yarn in this repo.
- **Adapter** — chosen in `vite.config.ts` by `$ADAPTER`: default `@sveltejs/adapter-vercel`
  (serverless); `ADAPTER=node` builds `@sveltejs/adapter-node` into `build/` for the
  self-hosted PM2 deploy (`ecosystem.config.cjs`). Either way assume **no persistent local
  filesystem in prod**.
- **Database** — PostgreSQL (Neon) via Drizzle ORM (`drizzle-orm/postgres-js`).
- **Auth** — Better Auth (email/password + GitHub); session populated in
  `hooks.server.ts`.
- **i18n** — Paraglide (inlang); locales `en` + `de-DE`; source messages in
  `messages/*.json`.
- **Styling** — Tailwind CSS v4 (`@tailwindcss/vite`); config in `src/routes/layout.css`.
- **Tests** — Vitest with three projects (`client`, `server`, `storybook`) + Playwright
  e2e.
- **Stories** — Storybook 10.

## Commands

```sh
pnpm dev                              # dev server (port per ORIGIN in .env)
pnpm build                            # production build (Vercel adapter)
pnpm build:node                       # production build (adapter-node -> ./build)
pnpm pm2:start                        # build:node + pm2 start ecosystem.config.cjs
pnpm pm2:reload                       # rebuild + zero-downtime pm2 reload
pnpm check                            # svelte-kit sync + svelte-check (type check)
pnpm lint                             # prettier --check . && eslint .
pnpm format                           # prettier --write .
pnpm test:unit -- --run               # run all Vitest projects once
pnpm test:unit -- --run --project server   # server (node) tests only — fast, no browser
pnpm test:e2e                         # Playwright (installs browsers first)
pnpm db:generate                      # generate a SQL migration from schema changes
pnpm db:migrate                       # apply migrations
pnpm db:push                          # push schema directly (dev only)
pnpm db:studio                        # Drizzle Studio
pnpm storybook                        # Storybook dev on :6006
```

`client` and `storybook` Vitest projects need Playwright's chromium; `pnpm test:e2e`
installs it. For quick server-logic iteration use `--project server`.

**Before reporting a task complete**, run and report the real result of:

```sh
pnpm check && pnpm lint && pnpm test:unit -- --run
```

Run `pnpm format` if you edited files. If something fails or is skipped, say so.

## Layout

```text
src/
  app.d.ts             # App.Locals: { user?, session? }
  env.ts               # defineEnvVars() — declare EVERY env var here
  hooks.server.ts      # sequence(handleParaglide, handleBetterAuth)
  hooks.ts             # reroute for localised URLs
  lib/
    index.ts           # re-exports surfaced through the `#lib` alias
    server/            # SERVER-ONLY — never import from client code
      auth.ts          # Better Auth instance
      db/              # Drizzle client + schema
    paraglide/         # GENERATED, gitignored — never edit by hand
  routes/
static/
messages/              # Paraglide source messages (en.json, de-de.json)
drizzle.config.ts      # runs outside SvelteKit — uses process.env directly
```

## Conventions

- **Import alias**: this repo uses `#lib` (Node subpath imports, see `package.json`
  `imports`), not `$lib`. Example: `import { auth } from '#lib/server/auth';`. `$lib`
  still resolves, but match the surrounding code and use `#lib`.
- **Environment variables**: declare each one in `src/env.ts` via `defineEnvVars`, then
  import from `$app/env/private` (server) or `$app/env/public` (client, `PUBLIC_`
  prefix). Add a matching placeholder line to `.env.example`. This project uses
  SvelteKit's explicit-environment-variables feature — do not reach for `process.env`
  or `$env/*` in app code (only `drizzle.config.ts` uses `process.env`, because it runs
  outside SvelteKit).
- **Server-only boundary**: anything touching secrets, tokens, or the database lives
  under `src/lib/server/`. SvelteKit fails the build if such a module becomes reachable
  from client code. Never relocate token or secret logic out of `server/`.
- **Svelte 5 runes** everywhere in app code (`$props`, `$state`, `$derived`, `$effect`).
- **Formatting**: Prettier with tabs, single quotes, no trailing commas, `printWidth` 100. Run `pnpm format`; do not hand-format.
- **Route data**: use `+page.server.ts` `load` / form `actions` for anything needing the
  DB or secrets; guard with `event.locals.user`.
- **i18n**: user-facing strings go through Paraglide messages — add keys to **both**
  `messages/en.json` and `messages/de-de.json`.

## Testing

`vite.config.ts` defines three Vitest projects:

- **client** — browser (Playwright chromium); `src/**/*.svelte.{test,spec}.{js,ts}`;
  excludes `src/lib/server/**`.
- **server** — node; `src/**/*.{test,spec}.{js,ts}` excluding `*.svelte.*`. Put
  server-module unit tests here, e.g. `src/lib/server/<feature>/<name>.spec.ts`.
- **storybook** — runs stories as tests.

`expect.requireAssertions` is enabled — every test must assert. Playwright e2e specs are
`*.e2e.ts` files under `src/routes/`.

Keep pure logic (crypto, parsing, expiry math) in functions testable without a DB or
network; inject or mock `fetch` for HTTP paths.

## Security

- Never commit `.env` or any real credential. `.env.example` holds placeholders only.
  `.gitignore` already excludes `.env*` (except `.env.example` / `.env.test`).
- Never log token or secret values — no `console.log`, and no error messages that echo
  them.
- Tokens never reach the client: no `localStorage`, `sessionStorage`, URL params, or
  client-side Svelte state holding token material.
- **TIDAL OAuth cookie exception:** the single user's encrypted TIDAL access and refresh
  tokens may be stored only in `HttpOnly`, `Secure`, `SameSite=Strict` cookies with a
  narrow `Path` and explicit expiry. Never expose, decode, or copy their values into
  client-side JavaScript, URLs, logs, or application state.
- Any file that would hold secrets or persisted tokens must be gitignored.

## Svelte MCP server

When the Svelte MCP tools are available, use them for Svelte 5 / SvelteKit work:

1. `list-sections` first — discover doc sections (read the `use_cases` field).
2. `get-documentation` — fetch every relevant section before answering or coding.
3. `svelte-autofixer` — run on any Svelte code you write; loop until it returns nothing.
4. `playground-link` — only when asked, and never for code already written to files.

## Git & commits

- Commit **only** as the repo owner; commits are GPG-signed automatically (git is already
  configured — don't override `user.*` or signing).
- **No attribution trailers.** Never add `Co-Authored-By:`, "Generated with …", or any
  tool/model mention to commit messages or PR bodies.
- Concise imperative subject; body explains _why_ when non-obvious. Conventional-commit
  prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`) welcome, not
  required.
- Push when a change is meaningful — a coherent unit that passes check + lint + tests.
  Don't push broken or half-finished work; don't sit on finished green work.
- Solo personal repo: work directly on `main` for small changes; use a short-lived
  branch + PR only for large or risky ones.
