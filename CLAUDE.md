# CLAUDE.md

Read **`AGENTS.md`** first — it covers the stack, commands, layout, conventions, testing,
and security rules for this repo. This file adds the working agreement specific to Claude.

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
- Work directly on `master` for small changes; branch + PR only for large or risky ones.

## Before saying "done"

Run and report the real result of:

```sh
pnpm check && pnpm lint && pnpm test:unit -- --run
```

Run `pnpm format` if you edited files. If a step fails or is skipped, say so plainly —
don't report success over a red result.

## Current focus

A personal **TIDAL OAuth token foundation**: a reusable, server-only `tidalClient` under
`src/lib/server/tidal/` with

- OAuth authorization-code flow + PKCE + `state`;
- an encrypted **single-row Postgres** token store (AES-256-GCM, key from
  `TIDAL_TOKEN_ENC_KEY`) — a `.data/*.enc` file was rejected because prod is Vercel
  serverless;
- automatic pre-expiry refresh with refresh-token rotation, persisted atomically;
- one-shot refresh + retry on a 401;
- a status endpoint and Connect / Disconnect dashboard, gated behind the existing Better
  Auth session; tokens never sent to the client.

Keep it single-user and simple. The detailed build plan lives in the project notes /
issue tracker.

## Reminders

- OAuth and token logic stays under `src/lib/server/` — never client-reachable.
- No token values in logs, errors, URLs, cookies (beyond the short-lived PKCE/state
  cookie), or client state.
- New env vars: declare in `src/env.ts`, add a placeholder to `.env.example`, never
  commit real values.
- Use the Svelte MCP tools (see `AGENTS.md`) when writing Svelte code.
