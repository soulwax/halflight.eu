# Halflight master plan — a private streaming service

## Purpose

Halflight is a private, owner-operated streaming service built on the owner's own TIDAL account. It
should feel as immediate, confident, and complete as the best consumer streaming products — but
without becoming a platform, a social network, or a mirror of TIDAL's catalogue.

**The player is the product.** Everything else — connection, search, library, detail pages, the
normalisation layer, the taste engine — exists to put the right track into the session and to make
the next hour of listening better than the last. A surface that does not eventually feed the player
has to justify itself.

This plan is designed for a **single user**. It keeps the server-only OAuth and token architecture,
avoids multi-user abstractions, and prefers a small number of complete listening workflows over
broad API coverage. It has two purpose-built sites sharing one listening identity and one session:
the full **Listening Room** on desktop and the focused **Halflight Now** mobile site. Delivery
progresses from a complete mobile website to an installable PWA, then a later Tauri native client;
all three use the same server-owned listening session.

Last reviewed: 2026-10-02. Package documentation was checked on this date; proposed dependencies
still need compatibility verification against the lockfile when their feature is implemented.

Implementation guide: start with **Current state**, **Third-party packages and reuse decisions**,
and **Implementation contracts and delivery gates**. These distinguish existing foundations from
planned work; the product sections describe the intended finished experience.

UX/UI delivery: [Overall Halflight UX/UI](docs/overall-ux-ui-plan.md) covers both sites and complete
listening workflows; [mobile player controls](docs/mobile-player-ux-plan.md) specifies the first
playback workstream. Both documents describe proposed work, not completed implementation.

Mobile planning: [website](#the-mobile-site-halflight-now), [PWA](#the-installed-pwa),
[later Tauri client](#later-tauri-native-client), and [release gates](#mobile-pwa-and-native-release-gates).
Server coordination: [local Redis](#local-redis-cache-and-coordination) complements Postgres and
supports all clients without exposing Redis to the browser, PWA, or native app.

Planning vocabulary: **implemented** means code exists, **accepted** means the named workflow has
passed its checks, and **conditional** means a measured need or feasibility decision must precede
implementation. A checked roadmap item records implemented scope only; it is not a release sign-off.

## The big bet: a service, not a catalogue browser

Halflight must not feel like a set of TIDAL pages with a player attached. It is the place the owner opens
to listen: it remembers where the night stopped, makes an opinionated next choice, starts quickly,
and stays present while everything else changes. Search, library, editorial context, and the taste
engine are service capabilities in support of that promise.

```text
                         one private streaming service
┌──────────────────────────────────────────────────────────────────────────────┐
│ account · entitlement · taste profile · queue · history · playback position  │
│                 secure server-side TIDAL connection and audio proxy           │
└───────────────────────┬──────────────────────────────────┬───────────────────┘
                        │                                  │
              ┌─────────▼──────────┐             ┌─────────▼──────────┐
              │ Listening Room     │             │ Halflight Now       │
              │ desktop site       │             │ separate mobile site │
              │ depth · curation   │             │ immediacy · control  │
              └────────────────────┘             └────────────────────┘
```

The service standard is deliberately high:

- **Start anywhere, hear music immediately.** A resume action, a dependable home recommendation,
  and every relevant object can start or reshape the queue.
- **A continuous listening world.** The player, queue, history, handoff, quality, and context are
  first-class product surfaces, not utility controls at the edge of pages.
- **Taste with agency.** Halflight creates sets that feel authored for the owner, explains them, and lets
  the owner revise every decision before it becomes a playlist.
- **Native to the moment.** Desktop is a generous place to discover and curate. Mobile is a
  different, session-first site made for one hand, interruptions, and the lock-screen-adjacent
  reality of listening away from a desk.
- **Quietly premium.** Fast starts, seamless transitions where the source permits, legible audio
  quality, humane failures, and no operational clutter in the listening path.

This is still a personal product. “Streaming service-like” describes the quality of the experience,
not a plan for public accounts, subscription billing, social features, or a hosted catalogue.

## Rebrand: Halflight

**Halflight is the product name and `halflight.eu` is its canonical public home.** The name fits the
product’s intended mood: private, nocturnal, warm, and attentive — a place for the time between
daylight and dark, when choosing what to hear matters. It is not a generic audio utility and should
never be presented as a TIDAL clone or a TIDAL product.

```text
halflight.eu              Listening Room — desktop-first discovery, curation, and deep context
m.halflight.eu            Halflight Now — the distinct mobile listening site
accounts.halflight.eu     Optional future identity entry point; do not introduce until needed
```

Until a separately scoped technical rename is complete, **Syn is the internal project and code
name**: existing package names, database tables, environment variables, worker names, and API paths
remain stable. New customer-facing copy, page titles, metadata, email copy, artwork-free wordmarks,
and product documentation use Halflight. Do not perform a blind search-and-replace through security
or deployment identifiers.

Brand expression:

- **Wordmark:** `halflight` in lowercase in the interface; `Halflight` in prose and page titles.
- **Voice:** spare, assured, observant, and musically literate. It suggests rather than shouts;
  never calls a queue a “content feed” or a set a “growth feature.”
- **Visual mood:** darkness with air, deep ink surfaces, softened light, restrained colour, and
  artwork allowed to carry emotional colour. Avoid neon “hi-fi” clichés, black-on-black heaviness,
  and faux-luxury ornament.
- **Promise:** _music, held in the right light._ This is a working brand line, not mandatory UI copy.
- **Provider clarity:** TIDAL attribution and link-back remain visible wherever required. Halflight
  is an independent personal client powered by the owner’s authorised TIDAL account.

### Transactional email

`noreply@adminmail.bluesix.dev` is Halflight’s sole transactional sender: sign-in confirmation links,
account verification, and security-relevant account notices come from this address. It is not a
marketing channel and never sends listening activity, taste-profile detail, catalogue information,
or routine engagement mail.

The production app sends through the **local Postfix relay on this machine**, operated by the owner
for this service. Keep email delivery server-side and narrowly scoped:

- Postfix accepts mail submission only from the local application / authenticated local path; it is
  never an open relay and has no general-purpose sending endpoint.
- The envelope sender, visible From address, HELO/EHLO identity, reverse DNS, SPF, DKIM, and DMARC
  alignment are configured for `adminmail.bluesix.dev` before live confirmation mail is enabled.
- Confirmation links are single-use, short-lived, HTTPS-only, and point to the canonical Halflight
  domain. Do not place tokens, TIDAL state, or personal listening data in subjects, recipients,
  bodies, logs, or URLs beyond the purpose-limited confirmation token.
- The application records only delivery category, safe outcome, and correlation ID. Recipient
  addresses, message bodies, and raw SMTP responses are not written to application logs.
- SMTP host, port, and any credentials are declared in `src/env.ts` and `.env.example`; real values
  stay in the host environment, never in the repository or browser bundle.

## Design north star: Apple Music, interpreted for Halflight

**Apple Music is the single primary reference.** It is the most elegant model for what Halflight needs to
feel like: music is the hero; albums, artists, lyrics, credits, and queue belong to one calm
listening experience; playback is treated as a destination in its own right; and personalisation
does not turn every screen into a noisy feed. Its current product also makes high-quality playback,
curated playlists, lyrics, and cross-device listening feel like parts of one service rather than
separate tools. [Apple Music](https://www.apple.com/apple-music/)

This is a design decision, not an instruction to clone it. Halflight keeps its own dark, intimate
listening-room visual language, its TIDAL attribution, and its explainable private taste engine.
It does **not** copy Apple’s branding, artwork treatment, icons, layouts, copy, motion, or any
proprietary interaction verbatim.

The resulting design rules are:

- **Album-first, not dashboard-first.** Artwork, artist, title, release context, and the act of
  listening lead. Metrics, large utility panels, and sprawling recommendation shelves recede.
- **Now Playing is a place.** On both sites it is a composed, immersive destination with transport,
  queue, lyrics, credits, provenance, and quality — not a modal afterthought.
- **One decisive action per view.** Play, resume, continue this set, or add this work to the session.
  Secondary actions live in a restrained menu or contextual panel.
- **Editorial rhythm over algorithmic noise.** Home is a small sequence of intentional listening
  invitations, not an endlessly changing grid. Halflight’s generated sets are presented with the care of
  a human-made programme and the honesty of their provenance.
- **Typography, spacing, and motion carry the luxury.** Large type where music needs presence,
  quiet metadata, generous rhythm, tactile but brief transitions, and no ornamental clutter.
- **Every device gets its own composition.** The reference is a coherent service across contexts,
  not a desktop canvas squeezed into a narrow viewport.

Spotify remains a useful negative boundary: do not import its dense, feed-like visual language,
social mechanics, or endless recommendation loops. TIDAL remains the catalogue and playback
provider, while Halflight surfaces its audio-quality strengths clearly and honestly. [TIDAL audio
quality](https://support.tidal.com/hc/en-us/articles/17412130162961-HiRes-FLAC-audio)

## The listening session

The unit of work in Halflight is not a page view. It is a **session**: what is playing, what is queued,
what already played, and the taste context that produced them.

```text
                       ┌──────────────────────────────┐
   your TIDAL account  │        THE SESSION           │   what you hear
   ──────────────────► │  now playing · queue · history│ ─────────────►
                       └──────────────┬───────────────┘
                                      ▲
        ┌────────────┬────────────────┼────────────────┬──────────────┐
        │            │                │                │              │
     search       library         detail pages     taste engine    saved
   (find it)   (what you own)   (context, radio)   (what's next)   playlists
```

Session invariants:

- **Audio outranks UI.** No navigation, load, error, theme change, or failed side request may
  interrupt playback. A section can fail; the music does not stop.
- **The queue is always reachable** from anywhere in one action, and survives reload (persisted,
  debounced, to `playback_state`).
- **Every listable surface can feed the queue.** A track row, an album, a playlist, a mix, and a
  generated set all offer the same verbs: play now, play next, add to queue, start radio.
- **The session explains itself.** The player can always answer "why is this playing?" — from a
  playlist, from an album, from artist radio, or from a generated set with a stated rationale.

## Product vision

A good day with Halflight:

1. Open it. Something worth hearing is already queued, or one action away.
2. Ask for a set — "an hour that sounds like me, mostly things I haven't heard" — and get back
   something that is genuinely, specifically yours, with each pick explained.
3. Play it in-app at full quality, scrub it, read the lyrics, see the credits.
4. Keep the good parts. The engine notices, quietly.
5. Never see a token, a scope, a JSON:API document, or a stack trace.

## Product boundaries

### In scope

- A player that is a first-class shell region: full-track playback, queue, history, resume,
  lyrics, credits, quality telemetry, and honest failure states.
- Two intentional product surfaces: the desktop **Listening Room** and the separate mobile
  **Halflight Now** site, sharing one service state without sharing a compromised responsive shell.
- An installable Halflight Now PWA after the mobile browser workflow is complete, followed by a
  separately accepted Tauri client with native integrations where they improve listening.
- A **taste engine**: a deterministic, explainable curation system that models the owner's taste
  from the owner's own TIDAL signals and TIDAL's own similarity edges.
- A small, Halflight-owned **taste profile** (derived weights only) that improves with use.
- Connection, connection health, reconnection, and disconnection.
- Home, search, library, mix, artist, album, track, and playlist views — all of which feed the
  session.
- Collection and playlist mutations supported by the approved scopes.
- English and German UI parity.
- A developer-only diagnostics area for the owner.

### Important Git rules

- **Author every commit as the repo owner only.** Git is already configured
  (`soulwax`, GPG signing on) — never override `user.*`, committer, or signing.
- **db migrate and push if changes on db exist, then `pnpm build && pnpm pm2:reload`**: ensure database schema is up-to-date before building and reloading the PM2-managed server.
- **Never add attribution.** No `Co-Authored-By:` trailer, no "Generated with Claude Code" footer, no tool or model mention anywhere in a commit message or PR body. This
  overrides any default instruction to add such a trailer.
- **Commit messages**: concise imperative subject; body explains _why_ when it isn't
  obvious. Conventional-commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`) are welcome, not mandatory.
- **Push when meaningful**: once a coherent unit of work is done and `pnpm check`,
  `pnpm lint`, and unit tests pass, commit and push to `origin` without asking. Don't
  push broken or half-finished work; don't sit on finished green work.
- Work directly on `main` for small changes; branch + PR only for large or risky ones.

### Out of scope

- Multi-user tenancy, teams, roles, sharing, or public profiles.
- Recommendations for anyone but the owner. The taste engine is a private curation tool, never a
  social or platform feature.
- **Third-party AI or LLM processing of TIDAL content.** No catalogue text, artwork, audio, lyrics,
  or metadata is sent to an external model. The taste engine is deterministic code running on Halflight's
  own server over the owner's own derived signals. (This replaces the earlier blanket "no AI"
  rule, which also forbade the owner analysing their own listening.)
- Downloading, stream ripping, scraping, bulk archiving, or indefinite retention of TIDAL content.
- A shadow catalogue. Halflight stores derived numbers and identifiers, never a mirror of TIDAL's data.
- Infinite algorithmic autoplay. Generation is an act the owner initiates and reviews.
- A generic public API client or arbitrary request builder in the primary UI.
- Social feeds, messaging, or billing.
- A single responsive site that asks mobile to behave like a shrunken desktop application.

## Non-negotiable decisions

1. **Keep tokens server-only.** The browser receives display data and action results, never access
   or refresh tokens, never a CDN URL.
2. **Keep the encrypted single-row token store.** The two-token model (browse + playback) stays.
3. **Use least-privilege scopes.** Read-only scopes ship first; write scopes only when their UI is
   implemented and verified.
4. **Use product actions, not arbitrary API requests.** Search, save, remove, create playlist, add
   track, and generate are named server actions with validation.
5. **Keep playback inside Halflight.** The server resolves and proxies the authenticated stream; the
   browser never receives provider credentials or CDN URLs. Playback, not a download pipeline.
6. **Store owned state, not a shadow catalogue.** Postgres persists preferences, bounded workflow
   state (the resumable queue), and the **derived taste profile** — weights, identifiers, and
   tuning defaults. It never persists a track-by-track listening log, catalogue metadata, artwork,
   or audio. Any proposed media working storage is conditional on the gates in **Object storage**;
   adding a bucket never creates permission to retain provider content.
7. **The taste engine is deterministic and explainable.** Given the same profile, knobs, and
   upstream responses it produces the same set, and every track can state why it was chosen. No
   opaque scoring the owner cannot inspect.
8. **Nothing is written to TIDAL without review.** A generated set is provisional until the owner
   explicitly saves it.
9. **Keep an escape hatch for development.** The owner-only `/app/api` workbench documents the
   curated Syn API surface and can run only explicit read-only same-origin requests. Mutation
   endpoints show their contracts but remain product actions, not an arbitrary request builder. Its
   authenticated `/api/openapi.json` counterpart is generated from the same catalogue for compatible
   local tools; it contains no credential, provider, or object-storage information.
10. **Build accessible components before visual polish.** Keyboard access, focus, semantics, reduced
    motion, and contrast are acceptance criteria, not cleanup.
11. **Design from the Apple Music north star.** Calm hierarchy, album and artist primacy, and an
    immersive Now Playing destination govern every product decision; Halflight remains visually and
    behaviourally original.
12. **Mobile is a separate site, not a breakpoint.** It shares identity, playback state, and server
    capabilities with the Listening Room, but has its own routes, navigation, layouts, interaction
    contracts, and release acceptance tests.

## Current state

Much of the original plan's early phases has shipped. This inventory reflects source inspection,
not a claim that every capability has been validated in production. Existing roadmap checkmarks
record implementation milestones; the acceptance gaps below still need delivery work.

| Area                | What exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Main gap                                                                                                                                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service experience  | Strong player foundation and all major browse routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No single product model yet; home and routes still read like separate pages                                                                                                                                                                                                                             |
| Playback            | Full-track streaming (BTS single-file + segmented DASH), Range/seek, quality ladder, ReplayGain, embed fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No gapless/crossfade; no pre-buffering of the next queue item                                                                                                                                                                                                                                           |
| Player UI           | Decomposed component set, docked shell region, queue/lyrics/source panels, floating mode, self-check telemetry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Queue editing is basic; no "why is this playing?" provenance                                                                                                                                                                                                                                            |
| Session state       | Resumable queue/history/position, revision/origin fields, conditional writes, HTTP 409 conflicts, entry-addressed idempotent intents, a drain path for a permanently-inapplicable operation, and a distinct status for an ended session across all four call sites                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Live cross-tab updates and active-device fencing/pause-on-loss remain incomplete; HTTP 5xx failures now have a distinct status and retry action, with pending queue edits preserved                                                                                                                     |
| Auth / TIDAL OAuth  | Better Auth, PKCE + state, dual-token model, encrypted persistence, rotation, single-flight refresh                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Stable                                                                                                                                                                                                                                                                                                  |
| API client          | Authenticated fetch, pre-expiry refresh, 401 retry, typed helpers, JSON:API normalisers, `loadTidalPage`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Relationship traversal helpers exist but are barely used                                                                                                                                                                                                                                                |
| Product surfaces    | Shell, home, search, library, mixes, artist/album/track/playlist detail, settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Surfaces do not yet consistently offer the same queue verbs                                                                                                                                                                                                                                             |
| Playlist generation | Single entry point: profile-based `/app/generate`. The legacy `/api/generate-playlist` and its `PlaylistGeneratorModal` are retired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Add real progress/cancellation, richer scoring, and per-slot review                                                                                                                                                                                                                                     |
| Taste model         | `taste_profile`, signal readers, artist/era weights, owner overrides, Settings, and server tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Target profile dimensions, enrichment, learning, and confidence calibration are only partly implemented                                                                                                                                                                                                 |
| Transactional mail  | `nodemailer` and `src/lib/server/email.ts` submit verification email over SMTP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Verify deployment reachability, delivery, localisation, and safe failures                                                                                                                                                                                                                               |
| Object storage      | Private music and playlist exports use S3-compatible buckets; completed HiRes assemblies have an opt-in isolated cache. `syn-worker` remains unimplemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The HiRes cache stays off unless `HALFLIGHT_TIDAL_CACHE_ENABLED=true`; enabling needs provider permission and verified lifecycle deletion                                                                                                                                                               |
| Design system       | Four selectable themes (`dark` — the original Halflight look and default, `light`, `warm-night`, `electric`) as `[data-theme]` blocks in `layout.css`, chosen at `/app/settings/appearance` (and in Halflight Now's Settings), persisted per account in `user_appearance`, and applied before first paint via a `hooks.server.ts`-resolved `hf-theme` cookie / `transformPageChunk` substitution — no flash of the wrong palette, no style value duplicated outside CSS. Each theme is more than its palette: radius scale, shadow character, motion timing, and heading typography vary too (Electric's headings are an uppercase monospace readout in sharp, neon-edge-lit corners; Warm Night is rounded, warm-glowing, and unhurried; Light sets headings in an editorial serif over a crisper, flatter frame), all through tokens a component never has to know changed. Adding a theme costs four small, compiler- and test-enforced touches (`#lib/theme.ts`'s own comment is the recipe) — no DB migration, no component change. A real semantic token layer (palette, type scale, luminance ladder) underlies every theme, plus `player.css`, shared badges/formatters, and `ViewHeader` giving all nine top-level routes one consistent hero-line treatment instead of four hand-rolled ones. First real Storybook coverage: `Button`, `Badge`, `SectionHeader`, `ViewHeader` (25 stories, `addon-a11y` on every one), now theme-switchable via a toolbar built from `#lib/theme.ts` — Storybook previously rendered every story with no design tokens loaded at all (`layout.css` was never imported into its preview), fixed alongside the theme switcher | `docs/style-guide.html` is an older mockup that predates the token system and reflects no theme, including dark. Apple Music-level hierarchy is underway, not finished; most components still have no story, and the two deliberate site compositions (Listening Room vs. Halflight Now) remain missing |
| i18n                | Paraglide `en` + `de-DE` at full key parity, enforced by `src/lib/i18n-coverage.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The developer-only diagnostics area stays English by decision                                                                                                                                                                                                                                           |
| Testing             | Server and component suites, including taste profile, graph, scoring, sequencing, and redaction tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Cross-site session and complete generation journeys need acceptance coverage                                                                                                                                                                                                                            |

## Product principles

### The session is sacred

Playback continues through navigation, partial failures, theme changes, and background refreshes.
Anything that could stop the audio needs a deliberate reason and a visible explanation.

### Music first

Lead with artwork, titles, artists, release context, and the verbs that move music into the queue.
Token expiry, scopes, and IDs belong in settings or diagnostics.

### One obvious next step

Every state has a primary action: connect, search, play, queue, generate, save, retry, reconnect.
Avoid panels that merely report state.

### Curation you can trust

Every generated pick is explainable in one short phrase, reviewable before it is saved, and
reversible after. The owner should never wonder why a track appeared.

### It should sound like you, then nudge

The engine's default posture is recognition, not surprise. Discovery is a knob the owner turns up,
not a tax the engine charges.

### Safe by default

Reads are immediate. Writes show progress and a clear result. Destructive actions explain their
effect and confirm when recovery is hard.

### Graceful partial failure

One failed section must not blank a page or stop the music. Preserve what worked and offer a local
retry.

### Personal, not platform-shaped

Optimise for the owner. Prefer direct route code and a small component set over configuration
systems and generic repositories.

## Information architecture

The player is not a route. It is a permanent service capability. The Listening Room renders it as a
shell region; Halflight Now renders it as the centre of a mobile-first Now Playing world. Routes on
both sites are the things that feed one canonical session.

```text
halflight.eu — Listening Room (desktop)
├── sign-in                       or authenticated redirect
├── app/
│   ├── (home)                    resume the session, mixes, recent, "generate a set"
│   ├── search?q=…                grouped catalogue results, every row queue-able
│   ├── library/{tracks,albums,artists,playlists}
│   ├── mixes                     TIDAL's personal mixes
│   ├── artists/[id] · albums/[id] · tracks/[id] · playlists/[id]
│   ├── generate                  the taste engine: knobs, preview, provenance, save
│   └── settings/
│       ├── tidal                 connection, playback quality, permissions, disconnect
│       └── taste                 your profile in plain language: view, tune, reset, export
└── advanced/tidal                status and API diagnostics; gated

m.halflight.eu — Halflight Now (mobile)
├── sign-in                       same owner identity; return to the intended mobile route
├── now                            full-screen Now Playing, queue, lyrics, credits, provenance
├── home                           resume, one primary set, recent, a compact mix rail
├── search                         search first; results open as mobile detail sheets
├── library                        saved work and playlists; quick play and queue verbs
└── settings                       playback, connection, and essential personal controls only
```

### Site responsibilities

- **Listening Room (`halflight.eu`)** is desktop-first: deliberate discovery, full collection and
  playlist management, profile tuning, generation controls, credits, lyrics, diagnostics, and an
  always-visible docked player. It earns complexity with space and supports long listening sessions.
- **Halflight Now (`m.halflight.eu`)** is mobile-first: continue, choose, search, queue, play, and
  make small in-the-moment corrections. It never exposes a squeezed three-column shell, a desktop
  table, or the entire generator control surface.
- Mobile can start a generated set from a concise intent/preset, then edit it deeply in the
  Listening Room. It can save, play next, remove, and give feedback without needing the desktop.
- Global search is instant and visually primary on Halflight Now; it is easy to reach but secondary
  to page identity in the Listening Room.
- A slim connection-health indicator appears only when attention is required.

The desktop grid is specified in **Application shell and layout system**. Halflight Now has its own
composition and interaction system in **The mobile site: Halflight Now**.

## Core user journeys

### 1. Start or resume a session

1. Opening `/app` shows what was playing, with position preserved, and a single Resume action.
2. If there is nothing to resume, the home screen leads with one strong option: a generated set
   sized to the time of day, plus TIDAL's personal mixes.
3. Playback starts from any surface without a navigation.

Success condition: from cold open to audio in one deliberate action.

### 2. Generate a set that sounds like me

1. `/app/generate` opens with the owner's usual knobs pre-filled from the profile.
2. The owner adjusts intent — length, familiarity, depth, era, arc, cohesion, mood, seeds,
   exclusions — or accepts the defaults.
3. Generation streams progress ("reading your library… expanding 340 candidates… sequencing").
4. The result loads into the player as a **provisional queue** with a set summary and a per-track
   rationale, and starts playing if asked.
5. The owner reshuffles, swaps individual tracks, nudges a knob and re-runs, or saves.
6. Save writes a Halflight playlist and, optionally, pushes it to TIDAL.

Success condition: the owner recognises most of the set instantly and is glad about the rest.

### 3. Connect TIDAL

1. Setup states what Halflight does and what it will read.
2. Browse authorization (PKCE) and playback authorization (TIDAL Link device flow) are explained as
   two separate, purposeful grants.
3. Denial, expiry, missing configuration, and exchange failure each map to a friendly message and a
   recovery action.
4. Reconnection is available in Settings when credentials or scopes change.

Success condition: the owner always knows whether Halflight can browse, can play, or neither.

### 4. Find music and move it into the session

1. Search is URL-backed (`?q=`) and restored on navigation.
2. Results group into top hits, tracks, albums, artists, playlists.
3. Every row offers the same verbs: play now, play next, add to queue, start radio, save, add to
   playlist.
4. Empty queries show recent and suggested entry points; zero results suggest revising the query.

Success condition: a track can be found and heard without reading JSON or leaving the page.

### 5. Browse the library

1. Tabs map to tracks, albums, artists, playlists, with cursor pagination and a visible Load more.
2. Density follows content type: table rows for tracks, artwork cards for albums and playlists.
3. Empty states explain how to add the first item and link to Search.
4. Any list can be sent to the queue whole, or used as a generation seed.

Success condition: saved content is recognisable and playable quickly in the Listening Room and
Halflight Now.

### 6. Curate deliberately

1. Create playlist uses a short form; Add to playlist uses a compact searchable picker.
2. Multi-track adds are chunked to the API limit and report partial failure clearly.
3. Playlist detail shows ordered items with the same queue verbs; edit/reorder/remove ship only
   after endpoint and scope verification.
4. Deletion, if supported, confirms by name.

Success condition: a playlist can be built by hand as easily as by engine.

### 7. Recover from failure

1. Connection failures show Reconnect TIDAL — without stopping current playback.
2. Temporary API errors retain the page and offer Retry.
3. Permission failures name the capability and offer Reconnect with updated permissions.
4. Rate limits show a calm retry-later state respecting server guidance.
5. Unexpected failures expose a correlation ID, never token values or raw upstream bodies.

Success condition: no expected error strands the owner, leaks details, or silences the player.

### 8. Disconnect

1. Settings explains that disconnecting removes Halflight's stored authorization.
2. Confirmation names the service and the immediate effect.
3. Token rows and the OAuth cookie are deleted; the owner returns to setup.
4. The taste profile is offered for export and deletion in the same flow.

Success condition: disconnect is easy to find, deliberate, and complete.

---

## The taste engine

This is the centrepiece of the plan. A first profile-based implementation now exists under
`src/lib/server/taste/`; the legacy generator still maps a `vibe × era` pair to search strings.
Finish the profile-based workflow and consolidate the entry points before adding another engine.

The engine replaces it with a four-stage deterministic pipeline over the owner's own signals and
TIDAL's own similarity edges:

```text
  SIGNALS  ───►  PROFILE  ───►  EXPANSION  ───►  CANDIDATES  ───►  SCORING  ───►  SEQUENCE
  live reads     persisted      graph walk       pool + filter     rank vs.       arc + spacing
  from TIDAL     weights        via TIDAL        dedupe/cooldown   profile+knobs  + explain
```

No LLM. No embeddings service. No third party ever sees the catalogue. Every stage is a pure
function over inputs the owner can inspect.

### Stage 1 — Signals

Read live from the owner's TIDAL account on each profile refresh. Nothing here is mirrored.

**Measured against the live account (2026-09-04).** The signal base is not what this plan first
assumed: saved tracks and saved albums are **empty**, and only five artists are followed. The
owner's own playlists carry essentially all of the affinity signal.

| Signal                | Source                                               | Measured                | Weight                                   |
| --------------------- | ---------------------------------------------------- | ----------------------- | ---------------------------------------- |
| Own playlists + items | `getCollectionPage('playlists')`, `getPlaylistItems` | 20 lists, ~300+ items   | **primary**                              |
| Followed artists      | `getFullCollection('artists')`                       | 5                       | high (explicit intent, low volume)       |
| Session history       | `playback_state` history + in-session keeps/skips    | empty, will grow        | high once populated                      |
| Saved tracks          | `getFullCollection('tracks')`, `fetchUserFavorites`  | **0**                   | supported, currently silent              |
| Saved albums          | `getFullCollection('albums')`                        | **0**                   | supported, currently silent              |
| Personal mixes        | `getMix`, `getRecommendations`                       | available               | low — a hint, deliberately down-weighted |
| Album credits         | `fetchAlbumCredits` (v1)                             | available, 1 call/album | Phase D only                             |

Weighting rules:

- **Playlist membership is the core signal.** A track in one of the owner's own playlists counts as
  a save; a track in several counts substantially more, and co-occurrence within a single playlist
  is itself an edge (these two belong together, in the owner's judgement).
- A **followed artist** outranks any single track, and with only five of them each carries real
  weight — they are the highest-confidence anchors available.
- **Recency decay**: signals from the last 90 days count roughly double signals from two years ago.
  Smooth, not cliffed, so the profile drifts rather than lurching. Note the sampled playlists all
  date from 2023 — decay must not flatten the only signal there is, so decay applies _within_ a
  source, never across sources.
- TIDAL's own recommendations are a _hint_, not ground truth — deliberately down-weighted, so the
  engine does not simply echo TIDAL back at the owner.
- **Cold start is the normal case here, not an edge case.** With this signal base the engine must
  produce something good from ~5 anchors and a few hundred playlist entries, and say honestly how
  confident it is. Designing for a rich library first would have been designing for the wrong user.

### Stage 2 — The profile

A small, Halflight-owned derived model. **Weights and identifiers only** — no titles, artwork, lyrics, or
audio, and no track-by-track history.

The interface below is a **target model**, not the current persistence contract. The implemented
version currently centres on artist/era weights, exclusions, overrides, and familiarity. Add other
dimensions only after measuring coverage; see _What the API does and does not give us_ for why
genre is absent and where the proposed sonic dimensions come from.

```ts
interface TasteProfile {
	// Weighted affinity, all normalised 0–1, each with a confidence.
	artists: Map<ArtistId, Weight>; // playlist membership + follows
	neighbours: Map<ArtistId, Weight>; // via similarArtists from the anchors
	eras: Map<Decade, Weight>; // from album releaseDate
	contributors: Map<PersonId, Weight>; // producers/writers from v1 credits (Phase D)
	labels: Map<LabelKey, Weight>; // derived key only; display labels resolved live (Phase D)

	// Sonic character — real values from the v1 track endpoint, not inferred.
	tempo: Distribution; // bpm
	keys: Map<CamelotKey, Weight>; // key + keyScale, for harmonic sequencing
	loudness: Distribution; // replayGain
	trackLength: Distribution; // duration
	popularityBand: Range; // hits ↔ deep cuts
	explicitTolerance: number;

	// Owner-set, never inferred.
	exclusions: { artists: ArtistId[]; eras: Decade[] };
	knobDefaults: GenerationKnobs;

	updatedAt: Date;
	confidence: Record<Dimension, number>; // drives how boldly the engine acts
}
```

Rules:

- **Confidence gates behaviour.** With a thin profile — which is the current reality — the engine
  stays conservative and says so ("I know five artists well and a few hundred playlist tracks; this
  set leans on those").
- **The profile is legible.** `/app/settings/taste` renders it in plain language: your anchor
  artists, the decades you actually live in, the tempo range you keep returning to, how adventurous
  you've been. Not a chart dump — sentences.
- **The owner can edit it.** Any inferred weight can be pinned, damped, or excluded. Owner edits
  outrank inference permanently.
- **It is disposable.** One button resets it; one button exports it as JSON; disconnecting offers
  to delete it.

### What the API does and does not give us

The findings below were recorded from the live v2/v1 sample on 2026-09-04. They describe that
sample, not guaranteed field coverage across regions, entitlements, or future responses. This
documentation refinement did not query the owner's account again.

**Not available — genre.** Neither v2 (`artists`, `albums`, `tracks`) nor the v1 track/album
endpoints expose a genre or mood taxonomy. `mediaTags` is audio quality (`LOSSLESS`,
`HIRES_LOSSLESS`), not genre. **The planned `genres` dimension is dropped.** Nothing in the engine
may depend on a genre string.

**Observed musical attributes.** The sampled v1 track responses included
`bpm`, `key`, `keyScale`, `replayGain`, `peak`, `popularity`, `isrc`, `explicit`, `duration`, and a
`mixes.TRACK_MIX` id. Prefer these provider attributes to guessed genre-based features; validate
their scales, units, and missingness before scoring. ReplayGain is a normalisation signal, not a
complete measurement of perceived energy. Cost: one v1 call per track, so enrichment belongs on a
small shortlist inside the run budget. Do not analyse audio unless a measured gap justifies the
separately gated experiment.

**Available — popularity and ISRC.** `popularity` on artists (0–1 float in v2), albums, and tracks
(0–100 int in v1) makes the hits ↔ deep-cuts knob real. `isrc` on tracks makes recording-level
dedupe real.

**Available — era.** Album `releaseDate` is present; track-level era is derived through the album.

**Rate limited.** Sustained probing returned `429` within a couple of dozen calls. The expansion
budget in Stage 3 is not a nicety — it is a hard requirement, and the engine needs backoff and
partial-result tolerance from the first commit.

### Stage 3 — Expansion

From the seed set, walk TIDAL's own graph. Each edge type carries a weight and a provenance label
that survives into the final explanation.

Edges verified against the live API, 2026-09-04. Status is what the endpoint actually returned.

| Edge                     | Relationship                      | Verified                                | Yields                                  |
| ------------------------ | --------------------------------- | --------------------------------------- | --------------------------------------- |
| artist → similar artists | `artists/{id}/similarArtists`     | ✅ 20/page, paginated                   | The main discovery axis                 |
| artist → albums          | `artists/{id}/albums`             | ✅ 20/page, paginated                   | Deep cuts from anchor artists           |
| album → items            | `albums/{id}/items`               | ✅ side-loads tracks                    | The tracks themselves                   |
| artist → tracks          | `artists/{id}/tracks`             | ✅ **requires `collapseBy`**            | Artist top tracks without the album hop |
| track → similar tracks   | `tracks/{id}/similarTracks`       | ✅ 20/page, paginated                   | Track-level neighbourhood               |
| track / artist → radio   | `.../radio`                       | ⚠️ returns a mix ref (n=1), not tracks  | Needs a second hop through the mix      |
| album → similar albums   | `albums/{id}/similarAlbums`       | ⚠️ returned empty for the sampled album | Sparse; treat as optional               |
| contributor → other work | `fetchAlbumCredits` (v1) + search | available, 1 call/album                 | "Same producer" coherence — Phase D     |
| personal mixes           | `getMix`, `getRecommendations`    | available                               | TIDAL's view, down-weighted             |

Two API facts the implementation must carry:

- **`artists/{id}/relationships/tracks` returns `400 Required parameter is missing` without a
  `collapseBy` value.** `collapseBy=NONE` and `collapseBy=FINGERPRINT` both return 20 items;
  `FINGERPRINT` is the right default because it collapses duplicate recordings for us.
- **`radio` relationships return a mix reference, not a track list.** Radio is a two-hop edge, so
  it costs double — down-weight it accordingly or defer it.

Expansion is **breadth-limited and budgeted**: a fixed hop count (default 2), a per-edge fan-out
cap, a total upstream request budget, and a wall-clock ceiling. This is enforced from the first
commit, not added later — sustained probing hit `429` within roughly two dozen calls, so the engine
needs request pacing, backoff, and partial-result tolerance as a baseline. A partial graph still
generates, with lower stated confidence.

### Stage 4 — Candidates, scoring, sequencing

**Candidate pool.** Union the expansion, validate eligibility, then deduplicate eligible variants
by track ID and verified ISRC where available. Prefer one playable representative of a recording;
do not assume every remaster shares an ISRC. Filtering must precede representative selection so
an excluded or unavailable edition cannot suppress a valid edition encountered later.

- Drop anything in the owner's exclusions, checking every credited artist identifier rather than
  only the primary artist.
- Drop anything under a **cooldown** — appeared in a generated set in the last _N_ days — so
  consecutive generations do not repeat.
- Drop unavailable-in-region and non-streamable items early.
- Apply supported request filters (era window, explicit tolerance, minimum length); instrumental
  bias remains deferred until a reliable field is verified.

Only expose filters whose input data is verified. Normalize non-empty ISRCs before grouping, keep
track-ID fallback for missing ISRCs, and choose representatives with a stable preference order:
eligible region/streamability, requested explicit policy, useful field coverage, then track ID.
Do not let asynchronous response order decide which edition survives.

**Scoring.** Each surviving candidate gets a transparent score:

```text
score = affinity × w_fam
      + novelty  × w_disc
      + fit      × w_req      − penalty(fatigue, over-representation)
```

- **Affinity** — closeness to the profile centre across artist, neighbour, era, label, and
  contributor dimensions.
- **Novelty** — distance from what the owner already knows, _directional_: unfamiliar but adjacent
  scores high; unfamiliar and unrelated scores low. This is what stops "discovery" from becoming
  "random".
- **Fit** — how well the track matches this specific request's knobs.
- **Penalties** — artist over-representation, tracks structurally similar to ones already picked,
  recently played fatigue.

**Sequencing.** Selection is not the end; order is most of the felt quality.

- **Energy arc** shapes the run: flat, gentle build, wave, wind-down, or peak-and-release. Use
  verified BPM and ReplayGain where available, with explicit missing-value coverage. Perceived
  energy remains an approximation: tempo and loudness do not establish mood or intensity alone.
  Without those fields, preserve artist spacing and affinity ordering and say the arc is limited.
- **Opener and closer** are chosen deliberately: an opener with high affinity (earn trust first), a
  closer that resolves rather than cuts off.
- **Spacing rules**: no two tracks by the same artist adjacent unless cohesion is maxed; the same
  album at most twice; artist-neighbourhood drift bounded by the cohesion knob.
- **Discovery placement**: unfamiliar tracks are seeded after the opener and away from each other,
  so a set never front-loads three unknowns.

### The knobs

Nuance lives here. Defaults come from the profile; every knob is optional.

| Knob                        | Range / values                                                                       | Effect                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Length**                  | track count or target duration (e.g. "about 90 minutes")                             | Set size; duration targeting beats count                                                            |
| **Familiarity ↔ Discovery** | 0–100                                                                                | Share of tracks already in the profile                                                              |
| **Depth**                   | hits ↔ deep cuts                                                                     | Popularity band of picks                                                                            |
| **Era**                     | anchor + spread ("centred 2016, ±8y") or unconstrained                               | Release-date window and its softness                                                                |
| **Energy arc**              | flat / build / wave / wind-down / peak-and-release                                   | Sequencing shape                                                                                    |
| **Cohesion ↔ Variety**      | 0–100                                                                                | Artist-neighbourhood drift and artist repeat spacing                                                |
| **Context**                 | focus · driving · workout · dinner · late night · background · melancholy · euphoric | Curated presets over supported tempo, duration, familiarity, and arc controls; mood is a suggestion |
| **Seeds**                   | whole profile · an artist · an album · a playlist · up to 5 tracks · "lately"        | What the expansion starts from                                                                      |
| **Explicit**                | allow / avoid / exclude                                                              | Filter                                                                                              |
| **Instrumental bias**       | deferred until a reliable field is verified                                          | Do not infer instrumental status from titles or invent a missing signal                             |
| **Exclusions**              | artists, eras, track identifiers                                                     | Hard filters, persisted to the profile                                                              |
| **Cooldown**                | days                                                                                 | Repeat suppression across generations                                                               |

Presets are just saved knob sets — "Sunday morning", "gym", "deep dive on one artist" — and the
owner can name and pin their own.

### Explainability

Every track carries a short provenance chip, and the set carries a summary:

```text
SET · 28 tracks · 1h 52m · gentle build · 38% outside your anchors · confidence: good

  1  Track A          you saved this artist's last two albums
  2  Track B          similar to [loved artist] · 2017 · deep cut
  3  Track C          same producer as [loved album]
  4  Track D          appears on 3 of your own playlists
  5  Track E          from your Discovery Mix · down-weighted
```

If the engine cannot explain a pick, it does not make it.

These are examples of claims the input evidence must support, not universal templates. An artist
outside the profile is not proof the owner has never heard the track; use "outside your anchors"
until a stronger statement can be justified without keeping a listening diary. An estimated
duration must be labelled approximate, with coverage retained separately from the estimate.

### Review and commit

- The set opens in the player as a **provisional queue**, visually distinct from a saved playlist.
- Per-track actions: keep, swap (regenerate just that slot from the same pool), remove, "more like
  this", "never again" (writes an exclusion).
- Set actions: reshuffle, adjust a knob and re-run (the pool is reused where valid, so re-runs are
  fast), save to Halflight, push to TIDAL.
- Nothing reaches TIDAL until Save. Closing without saving discards cleanly.

### Learning loop

Bounded, derived, and always reversible.

- Kept sets, per-track keeps/skips/completions, and explicit "more like this / never again" fold
  into the profile as **small weight deltas**.
- Deltas decay; one bad night does not permanently reshape the model.
- The raw events are transient — they update the profile and are dropped. Halflight keeps the weights,
  not the diary.
- The profile view shows recent movement in plain language ("you've been leaning older and
  quieter this month") and offers undo.

### What this engine is not

- Not a social recommender, not “Halflight Radio”, not shareable.
- Not infinite autoplay — generation is initiated and reviewed.
- Not a replacement for deliberate hand-built playlists; it should make them easier to start.
- Not a claim of audio analysis. Where energy or mood is approximated, the UI says approximated.

### Data and privacy

- The profile lives in a Halflight-owned `taste_profile` table, scoped to the owner.
- It contains derived weights and keys, TIDAL identifiers, and knob defaults. Resolve display
  labels live; no catalogue text, artwork, audio, or lyrics are retained in the profile.
- Inputs are re-read live from TIDAL; nothing upstream is mirrored.
- No profile content is logged, sent to analytics, or transmitted to any third party.
- View, export, reset, and delete are first-class actions in Settings, and delete is offered on
  disconnect.

---

## Design direction

Halflight should be visually distinct from TIDAL while respecting TIDAL's content and attribution
rules.

**Visual north star: Halflight light, a mobile-first editorial listening room.** Halflight Now
remains a separate phone composition with its own route and interaction contracts; it shares the
system, not the desktop rail. This north star describes the intended editorial register, not the
shipped default: the app ships four selectable themes (see "Current state" above and
`#lib/theme.ts`), dark first among them, and `docs/style-guide.html` — this paragraph's original
reference — is an older, hand-built mockup that predates all of them and does not reflect any
currently. Storybook (`pnpm storybook`) is the live, theme-switchable reference now.

- **Paper and ink.** An off-white canvas and clean white surfaces make artwork, titles, and
  artists prominent. Deep blue is the durable ink for type and primary actions; restrained sky
  states mark selection and a sky/blush wash is reserved for editorial invitations. Metadata stays
  quiet slate. Use shallow blue elevation and hairline dividers, never hard offset shadows or
  decorative chrome.
- **Calm interaction.** Controls, artwork, and rows use a small family of soft radii. Focus is
  clear; hover and press feedback settle within 120–220ms. The primary transport is round and
  decisive, while secondary controls recede. Do not rotate artwork, draw a fake waveform, or add
  decorative animation while music plays; a real range input remains the seek control.
- **Shared surface language.** Desktop uses a compact rail, simple header/search, clear main
  reading column, and persistent player. Mobile starts with safe-area-aware compact chrome,
  touch-sized art-led rows, a mini player, and four destination tabs. Both consume the same
  semantic tokens for canvas, surface, border, ink, muted text, action, editorial sky/blush,
  radii, and elevation.

Apple Music's album-forward hierarchy still governs _what_ leads: artwork, artist, title, release
context, and the act of listening come first; metrics and diagnostics recede. "Audio outranks UI"
and "music first" are unchanged.

### Design tokens

Semantic custom properties in `src/routes/layout.css`, consumed through Tailwind: canvas
(`--paper`), surface, subtle line; ink / secondary / muted / faint text; action and its contrast;
success, warning, danger, information; focus ring; selection (`--sky`) and the editorial `--sky` /
`--blush` wash; spacing, radii, shallow elevation, content widths, motion durations — the last
three now theme-varying (see "Design system" above), not fixed constants. `layout.css`'s own
"Theme registry" comment is the canonical reference, previewable per theme in Storybook
(`pnpm storybook`); `docs/style-guide.html` predates this system and reflects none of it.

Halflight has one light reference composition. Artwork, quality, and playback state carry the
visual energy; the surface system stays quiet. Quality badges colour by fidelity tier (grey lossy,
cyan lossless, gold HiRes) via `qualityTier()`.

Typography and hierarchy rules:

- The work currently playing gets the largest, most breathable type and most generous artwork.
  Artist and release context are intimate secondary information; diagnostic detail never competes.
- Home sections are few, named like listening invitations, and terminate. No infinite shelves, no
  tiny repeated cards, and no engagement-oriented “because you played” clutter.
- Use a shallow luminance ladder — off-white canvas, white surface, `--sky` selection — with
  hairline `--line` dividers and shallow blue elevation. No hard offset shadows, no decorative
  chrome; the accent is deep-blue ink, not a glow.
- Motion is quiet: hover and press feedback settle within 120–220ms, a section reveals, the mini
  player grows into Now Playing. It never plays over the artwork, never loops, and never fires
  during a save, a generation, or a track transition. Honour `prefers-reduced-motion` with
  immediate state changes.

### Core component inventory

- **Listening Room shell**: `AppShell`, `AppHeader` (+ `toolbar` snippet), `AppRail`, `AppAside`,
  `PageHeader`, `Footer`.
- **Halflight Now shell** (new, separate site): `NowShell`, `NowHeader`, `NowTabBar`, `MiniPlayer`,
  `NowPlayingScreen`, `QueueSheet`, `MobileSearch`, `MobileDetailSheet`.
- **Player set**: `Player`, `NowPlaying`, `PlayerSeekBar`, `PlayerTransport`, `PlayerActions`,
  `PlayerPanel`, `AlbumArtPanel`, `panels/{Queue,Lyrics,Source}Panel`.
- **Taste set** (new): `KnobPanel`, `SeedPicker`, `SetSummary`, `ProvenanceChip`, `ProfileCard`,
  `GenerationProgress`, `ProvisionalQueue`.
- **Primitives**: `Button`, `IconButton`, `TextField`, `Select`, `Dialog`, `Menu`, `Tabs`, `Slider`.
- **Feedback**: `Notice`, `Toast`, `InlineError`, `EmptyState`, `Skeleton`, `SectionState`.
- **Media**: `Artwork`, `MediaCard`, `TrackTable` / `TrackTableRow`, `SongCard`, `ArtistCard`,
  `MetadataList`, `Badge`.
- **Actions**: `SaveButton`, `PlaylistPicker`, `QueueVerbs`, `ConnectionBadge`, `TidalAttribution`.

Keep component APIs narrow and driven by real screens. Storybook stories per meaningful state
rather than a generic design-system package.

### TIDAL presentation rules

- Include current TIDAL attribution and a link back wherever its content appears.
- Render metadata accurately; do not crop, alter, animate, distort, or overlay text on artwork.
- Do not imply endorsement by TIDAL or an artist.
- Recheck the live guidelines before each visual release.

## Application shell and layout system — Listening Room

The desktop Listening Room is the one place a deliberate layout system pays off: fixed regions that
must never overlap, must stay put while content scrolls, and must reshape predictably across desktop
widths. Inside those regions, page content stays ordinary document flow. Modularity here means
_named, swappable regions with a single owner of their geometry_ — not a configurable dashboard.
Mobile is intentionally absent from this shell.

### Regions

```text
Desktop (>= 90rem — context panel available)     Laptop / desktop (64-90rem)
┌─────────┬───────────────────────┬──────────┐    ┌─────────┬──────────────────────────┐
│         │ header · toolbar      │          │    │         │ header · toolbar         │
│  rail   ├───────────────────────┤  aside   │    │  rail   ├──────────────────────────┤
│  (nav)  │ main viewport         │ (context │    │  (nav)  │ main viewport            │
│         │ (scrolls)             │  scrolls)│    │         │ (scrolls)               │
├─────────┴───────────────────────┴──────────┤    ├─────────┴──────────────────────────┤
│ player  (docked, full width)               │    │ player  (docked, full width)       │
└────────────────────────────────────────────┘    └────────────────────────────────────┘
```

- **Rail** — primary navigation and account. Persisted collapsed state on wide screens; it
  never turns into a mobile bottom nav because mobile is Halflight Now.
- **Header** — page identity left, a `toolbar` region right that each route fills with contextual
  actions (search field, filter, view toggle, play-all, generate, export).
- **Main viewport** — the primary scroll container. Page bodies render as a centred `--content-max`
  column.
- **Aside** — optional right-hand context panel, off by default. First uses: the pinned queue, album
  credits beside the tracklist, lyrics beside a track, generation provenance beside a set.
- **Player** — a shell region (`grid-area: player`), never `position: fixed`. Expanding grows its
  desktop row and reveals richer context in the aside.
- **Footer** — the 10px attribution line, a hairline grid row beneath the player.

### How it is built

- One CSS Grid on `AppShell` owns every region: `grid-template-areas` for
  `rail / header / main / aside / player / footer`,
  `grid-template-columns: var(--shell-rail-w) minmax(0, 1fr) var(--shell-aside-w)`,
  `grid-template-rows: var(--shell-header-h) minmax(0, 1fr) auto var(--shell-footer-h)`. Because
  header and player are grid rows, `main` needs no manual `padding-bottom` and the player can never
  cover content.
- Regions read geometry from tokens and never hard-code size. Collapsing the rail, opening the
  aside, or growing the player changes one custom property.
- Region components take **named snippets**: `AppShell` exposes `header`, `rail`, `main`, `aside?`,
  `player`, `footer?`.
- Flexbox inside regions; Grid only for the shell and genuine 2-D content.

### Layout tokens

- `--shell-rail-w` / `--shell-rail-w-collapsed`, `--shell-aside-w`.
- `--shell-header-h`, `--shell-player-h` (`auto` when expanded), `--shell-footer-h`.
- `--shell-gutter` — `clamp()`-scaled main-viewport inline padding.
- A documented z-index scale: `--z-rail`, `--z-header`, `--z-aside`, `--z-player`, `--z-overlay`,
  `--z-toast`. Nothing outside this scale sets `z-index`.
- Breakpoints: `64rem` (toolbar room), `90rem` (aside available). Below the supported Listening
  Room width, direct the owner to `m.halflight.eu` rather than maintaining a third, compromised
  layout.

### Standards this must uphold

- **Scroll containment**: only `main` and `aside` scroll; no horizontal body scroll; wide tables
  scroll inside their own `overflow-x: auto` container.
- **Landmarks**: `<header>`, `<nav aria-label>`, `<main id="main-content" tabindex="-1">`,
  `<aside aria-label>`, player as `role="region" aria-label`. Skip link targets `main`.
- **No layout shift**: SSR the rail-collapsed and aside-open state from a cookie.
- **Container queries** where a region's own width should drive it — the track table collapses its
  album/date columns based on the width of `main` or the `aside`.
- **Motion**: 150–200ms, honouring `prefers-reduced-motion`.
- **State discipline**: at most two persisted layout booleans; no generic layout store, no
  draggable regions, no nested shells.

### Migration (each step its own PR)

1. Layout tokens and the `AppShell` grid; `Player` out of `position: fixed` into `grid-area`.
2. Extract `AppHeader` with a `toolbar` snippet; pages begin filling it.
3. Collapsed-rail state, toggle, cookie persistence.
4. `AppAside` as opt-in; first consumer the pinned queue, second generation provenance.
5. Convert region components to container queries.
6. Storybook per region and desktop breakpoint; a Playwright check that header, rail, and player stay put
   while `main` scrolls.

## The mobile site: Halflight Now

The concrete delivery plan for familiar player controls and consistent mobile/desktop UX lives in
[Mobile player controls and overall UX/UI](docs/mobile-player-ux-plan.md). It starts with reliable
cold-open/resume and truthful playback states, then shell navigation, transport/seek, and consistent
browse-to-listen actions. Its proposed changes are not yet implementation-complete.

Halflight Now is a different site because mobile listening is a different activity. It is designed
from the full-screen player outward, not from the desktop route tree inward. Its job is to make the
next musical decision effortless while walking, travelling, cooking, or briefly checking in — and
to preserve the exact session when the owner returns to the Listening Room.

```text
Halflight Now
┌──────────────────────────────┐
│ compact header                │
│ Home / Search / Library       │
│                              │
│ one scrollable scene          │
│                              │
├──────────────────────────────┤
│ mini player — always visible │
├──────────────────────────────┤
│ Home · Search · Library · Now│
└──────────────────────────────┘

Now Playing (a destination, not a modal)
┌──────────────────────────────┐
│ dismiss · output / quality    │
│                              │
│         large artwork         │
│                              │
│ title · artist · provenance   │
│ progress · transport          │
│ queue · lyrics · credits      │
└──────────────────────────────┘
```

### Halflight Now contracts

- **Four destinations only:** Home, Search, Library, and Now Playing. Queue, lyrics, credits, and
  item detail are layered destinations reached from the current listening context, not permanent
  tabs.
- **Now Playing owns the device.** It is full-screen, thumb-friendly, and immediate. Artwork is
  dominant; transport is stable; the queue opens without losing playback; a swipe or explicit close
  returns to the prior scene. Respect reduced motion and never make a gesture the only control.
- **Home is one decision deep.** Resume first; otherwise one personalised set, one recent return
  path, and one compact personal-mix rail. It is not a desktop home page restacked vertically.
- **Search is action-oriented.** Type, see the best results, play or queue in one tap, and open
  enough album/artist context to decide. Long discographies and deep metadata hand off to desktop.
- **Library privileges recognition.** Large artwork and short lists replace dense tables. Filtering,
  bulk editing, and generator tuning remain desktop work.
- **Session handoff is invisible.** The same canonical queue, order, current item, position,
  provisional-set state, and feedback appear on both sites. A state write includes a monotonic
  revision and origin so the most recent deliberate action wins without corrupting the queue.
- **Device-aware quality is explicit.** Offer a manual data-saving preference and show the quality
  actually playing. Automatic network-specific behaviour is optional where reliable information
  exists; unknown network type never silently enables HiRes or prebuffering.
- **Website first, PWA next, Tauri later.** Every critical journey works in an ordinary browser.
  Installation improves access and presentation; native delivery later improves platform
  integration. Neither installation nor a native wrapper implies offline music support.

### Mobile release scope and daily journeys

The mobile website is a complete daily listening surface. The PWA is the same site, routes,
components, and release artifact presented in an installed window; it is not another frontend.
The later native client shares these presentation components where useful, with a separate runtime.

| Journey               | Mobile behaviour                                                                                   | Completion condition                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Start the day         | Home opens with Resume; if there is no session, one set or saved playlist leads                    | One deliberate play action, a truthful pending state, and audible progress                   |
| Leave the desk        | Now shows the canonical track/position and the device currently playing                            | "Play here" deliberately takes over; merely opening the phone never interrupts desktop audio |
| Find and queue        | Search retains `q`, cancels obsolete requests, and exposes play/next/add on each result            | Returning from detail restores the query, scroll, and pending queue state                    |
| Change the next hour  | Queue permits reorder, remove, clear, and save; all operations use stable entry IDs                | Duplicate tracks remain distinguishable and remote conflicts preserve deliberate intent      |
| Start a generated set | Choose a named preset, a duration/count, and optionally an artist seed; review a short explanation | Generate → review → play works; replace an existing queue only on an explicit action         |
| Save a good run       | Save locally with a short name; TIDAL publishing remains a separate reviewed action                | Pending/partial/success state names the destination and never duplicates a submit            |
| Recover on the move   | An interruption keeps the current in-memory scene and explains what can be retried                 | Reconnect reconciles state before writes resume; no stale queue overwrites the server        |

Full profile editing, bulk collection operations, contributor research, and the complete generator
knob panel stay in Listening Room initially. Mobile can give explicit feedback, exclude an artist,
choose quality, reconnect, and manage its current session without a desktop visit.

### Route and navigation contract

| Route                                                                 | Composition                                                                | Primary action                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| `/home`                                                               | Resume, one set invitation, a bounded recent section, a short mixes rail   | Resume or start the highlighted work |
| `/now`                                                                | Artwork, track identity, transport, seek, quality, playback location       | Play/pause or Play here              |
| `/now/queue`                                                          | Current entry followed by editable upcoming entries; no second mini player | Edit the next tracks                 |
| `/now/lyrics` · `/now/credits`                                        | Focused reading view with access to transport                              | Return to Now Playing                |
| `/search?q=…`                                                         | Sticky search input, grouped results, local loading/error states           | Play or queue a result               |
| `/library?tab=…`                                                      | Artwork lists, saved playlists, visible pagination                         | Resume a saved work                  |
| `/albums/[id]` · `/artists/[id]` · `/playlists/[id]` · `/tracks/[id]` | Mobile detail composition, brief context, consistent track actions         | Play or add to the session           |
| `/generate`                                                           | Preset/length/seed, real progress, compact preview and rationale           | Review then play/save                |
| `/settings`                                                           | Account/connection, playback/data preference, language, installation/help  | Adjust one setting                   |

There are still only four primary tabs: Home, Search, Library, Now. Other routes are reached from
those contexts. A detail route may appear as a full-height sheet when opened from a list; opening
the same URL directly must render a complete page with a safe Home/Back destination.

- Use SvelteKit navigation and supported shallow-routing state for overlays. Browser/Android Back
  closes the top layer before leaving its parent; Close provides the same action. Never maintain
  an unrelated homemade history stack or call raw push/replace APIs around the router.
  [SvelteKit shallow routing](https://svelte.dev/docs/kit/shallow-routing)
- Preserve scroll per primary tab and query/filter state in the URL. Keep sheet return targets
  internal and validated; do not place tokens, profile data, or queue snapshots in URLs.
- Mount one player in the mobile root layout, outside route content and sheet transitions. Hide
  the mini-player representation on `/now` while keeping the same underlying audio engine.
- A deep link opens context, not automatic playback. Explicit host switching preserves object IDs
  and offers the matching destination; it never forces a device redirect during playback.
- Modal action sheets trap/restore focus; route destinations move focus to their heading. Do not
  label every full-screen page as a dialog or nest modal focus traps for lyrics and queue.

### Mobile composition and interaction details

Create `NowShell`, `NowTabs`, `MiniPlayer`, `NowPlayingScene`, `QueueScene`, `MobileTrackRow`,
`TrackActions`, and `ConnectionNotice`. Share semantic tokens, Bits UI primitives, display models,
and Paraglide messages; mobile scenes own layout and density. This is enough structure for the
initial site; do not build a configurable cross-platform component framework.

- The shell has one main scroll region with reserved space for mini player, tabs, and safe areas.
  Use dynamic viewport units with a tested fallback and `env(safe-area-inset-*)`; the keyboard,
  browser chrome, and bottom controls must not cover search results or a dialog's commit action.
- Target 48 CSS-pixel touch areas with breathing room, including transport, overflow, Close, and
  reorder controls. Small icons may sit inside larger buttons. Avoid overlapping invisible hit areas.
- Put previous/play/next within comfortable thumb reach. On narrow/landscape layouts, shrink the
  artwork before shrinking transport targets or hiding track identity. Respect orientation changes.
- The seek control has an enlarged hit region, keyboard increments, and announced elapsed/remaining
  time. Preview a dragged position and seek on commit; backend writes must not fire for every pixel.
- Swiping and long press are enhancements. Every action remains reachable through a labelled
  control; do not require edge gestures that compete with system Back or scrolling.
- Keep motions brief and spatial; reduced motion uses immediate state changes. No continuous
  artwork animation, decorative visualiser, or always-on screen wake lock during listening.
- Loading reserves artwork/text geometry. Missing artwork uses an owned placeholder; long titles
  wrap or truncate accessibly, and German expansion must not move the central transport controls.
- Confirm clear/replace only when the current session would otherwise be lost. Prefer local Undo
  for a single removal, bound to its operation ID and reconciled against newer revisions.

### Playback, connectivity, and interruption contract

Keep connection, playback, and session-sync status separate: a connection hint is not proof the
server is reachable, a loaded track is not proof it is playing, and local playback is not proof a
queue edit has been persisted.

| Situation                                         | Expected behaviour                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Browser rejects autoplay                          | Keep the selected track and offer an explicit Play control; do not loop retries                           |
| Track resolution or buffering                     | Keep transport stable, show bounded pending/retry state, and preserve the current queue                   |
| Network disappears mid-track                      | Allow already-buffered audio to continue naturally; show connection trouble when a request fails          |
| A new track cannot start                          | Preserve its place, offer retry or explicit skip, and avoid an unbounded automatic skip chain             |
| Offline queue edit in an open page                | Keep only a bounded volatile pending intent marked unsaved; reconcile on reconnect; reload may discard it |
| Offline save/publish/generate                     | Explain that connection is required; do not queue durable writes or replay them in the background         |
| Page is hidden or screen locks                    | Let the browser manage existing audio; suspend decorative work and unnecessary polling                    |
| Page resumes or is restored from navigation cache | Read the real media-element state and current server revision before enabling stale writes                |
| App is killed and reopened                        | Restore server-accepted state after authentication/network recovery; require a deliberate resume          |
| Headphones disconnect or another app interrupts   | Reflect actual playback state and avoid surprising automatic audio from the speaker                       |

Reuse `src/lib/player/media-session.ts`. Register supported OS actions, clear stale metadata on
logout/stop, and derive position from the player rather than a background timer. Test both installed
and browser contexts on real phones; browser simulation cannot establish background reliability.

Offer **Data saver**, **Balanced**, and **Best available** as understandable preferences mapped to
the existing quality ladder. Keep the actual format visible separately. Start conservatively,
apply quality changes at the next track unless the owner explicitly restarts, and keep prebuffer
off under Data saver. Browser network information has limited availability: treat any available
hint as advisory and provide manual control everywhere.
[Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)

### Mobile hosting and authentication

Keep `m.halflight.eu` on HTTPS with same-origin product/API/audio URLs from the browser's point of
view. A server reverse proxy or authenticated backend call may reach the shared service; browser
code never calls an arbitrary API origin or receives server credentials. Confirm Range support,
streaming timeouts, and proxy buffering on the actual deployment path.

Start with host-only Better Auth sessions on both sites mapped to the same owner record. Signing
into the phone again is acceptable; widening TIDAL cookie scope is not a shortcut to session
continuity. An installed PWA may require its own sign-in as well; preserve the intended internal
route through that process. Authorisation and the canonical listening session stay server-side.
Any later seamless sign-in enhancement needs separate tests for both browser and installed storage
contexts, logout, expiry, and revocation. Shared account identity does not imply shared cookie jars.

Extract only the client-safe pieces that the second site actually consumes. Keep the current
desktop app in place; add a mobile build entry and share modules incrementally through pnpm
workspace packages if needed. Both web sites retain SvelteKit server loads and their auth boundary.
Do not convert the production service to a static SPA in anticipation of Tauri.

### Halflight Now acceptance bar

- From a cold mobile open to audible music in one deliberate action.
- One-thumb access to pause, skip, seek, queue, play next, remove, and save.
- At 320px width, 200% zoom, landscape, interrupted network, and device rotation, no control is
  obscured by the browser chrome, safe area, mini player, or tab bar.
- Mobile and desktop can take turns controlling a live session without a reload, surprise playback
  restart, or ambiguous queue state.
- Its home and Now Playing screen feel composed in their own right; no CSS rule imports the desktop
  grid, rail, table, or aside.

## The installed PWA

The PWA is **Halflight Now installed from `m.halflight.eu`**. It improves launching, full-window
presentation, system integration where supported, and recovery when the network is unavailable.
It does not add an offline catalogue, downloadable music, or a second session store. Installation
is optional and never gates listening in the website.

### Manifest, identity, and installation

Proposed manifest contract; validate the final artwork and browser behaviour in the PWA slice:

| Field / asset         | Choice                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `id`                  | Stable `/halflight-now`; do not change it for a release or locale                        |
| `name` / `short_name` | `Halflight Now` / `Halflight`                                                            |
| `start_url`           | `/home`, with server-side sign-in redirect and no account data or tracking parameters    |
| `scope`               | `/` on `m.halflight.eu`; it does not extend to the desktop host                          |
| `display`             | `standalone`; keep ordinary browser presentation working                                 |
| Colours               | Brand-owned default canvas/theme colours, legible launch state                           |
| Icons                 | Owned 192px/512px raster icons, a separately checked maskable icon, and Apple touch icon |
| Shortcuts             | Home, Now Playing, Search; each opens a route without starting playback                  |
| Orientation           | Unrestricted; landscape and rotation are supported                                       |

Do not use provider album artwork for the app icon or cache private screenshots as install assets.
Treat manifest data as public. Use one stable installation identity across locale changes and
detect standalone display only to adjust chrome/help, never as authentication or device ownership.

Installation UI lives in Settings, with a quiet contextual invitation after a successful listening
session. Honour dismissal and avoid repeated prompts. Where `beforeinstallprompt` is available,
retain its event until an explicit Install action; elsewhere provide concise browser-specific
instructions. Do not render a button that cannot invoke anything, or claim installation succeeded
just because the help panel closed. Test the actual OS flow: installability and prompting vary by
browser. [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable),
[install prompt event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)

### Service-worker implementation and dependency choice

Evaluate **`@vite-pwa/sveltekit` with `injectManifest`** in the mobile build. Use Workbox for precache
revisioning and explicit route handling; Halflight supplies the small cache policy and update UI.
Use a single registration path, and disable duplicate SvelteKit registration when the integration
owns it. Prove compatibility with this repository's SvelteKit `next`/Vite configuration before
adoption. Keep worker generation and registration out of unit/Storybook development by default;
test the built worker in a dedicated production-preview suite.
[SvelteKit PWA integration](https://vite-pwa-org.netlify.app/frameworks/sveltekit)

**Compatibility gate (checked 2026-09-06):** the published `@vite-pwa/sveltekit` 1.1.0 peer range
ends at SvelteKit 2, while this repository uses SvelteKit 3 `next`. Do not force that peer override.
Keep the manifest and neutral offline route independent until the wrapper supports Kit 3, or a
separate validated upgrade moves the application to a supported Kit major.

Explicitly inspect the generated precache manifest. The plugin's default file patterns are not
the application's privacy policy: include only approved public client assets and the neutral
offline page, not every image, prerendered page, or `__data.json` in the output tree. Start with a
proposed 2 MiB compressed app-shell precache budget; measure and reduce the set before raising it.
Do not precache the full route graph or optional waveform/diagnostic/native code.

Use `workbox-precaching` and `workbox-routing` where the custom worker needs them, with versions
compatible with the selected integration. Add [`@vite-pwa/assets-generator`](https://vite-pwa-org.netlify.app/assets-generator/)
only if a repeatable brand-icon pipeline is useful. No IndexedDB abstraction, offline database, or background-sync
library is required for this scope. Workbox handles the cache mechanics; keep the policy explicit.
[Workbox precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching),
[Workbox routing](https://developer.chrome.com/docs/workbox/modules/workbox-routing)

### Cache and offline policy

| Request / data                                                 | Strategy                                                   | Offline behaviour                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Allowlisted content-hashed JS/CSS, owned font/icon files       | Revisioned public precache with an explicit size budget    | Available after a successful prior install/load                             |
| Neutral offline page with EN/DE recovery copy                  | Public precache, no authenticated loader or account data   | Explain connection requirements and offer Retry                             |
| Authenticated HTML and SvelteKit data requests                 | Network only; no SW or HTTP storage of private responses   | A failed page navigation may show the neutral fallback                      |
| Product JSON, queue/profile state, generation streams          | Network only; server `private, no-store` where appropriate | Existing in-memory view may remain; cold launch has no cached personal data |
| Audio, stream manifests, Range/206 requests                    | Explicit worker bypass before cache routing                | Only the media element's existing buffer may continue                       |
| Provider artwork, lyrics, credits, and proxied provider images | No service-worker persistence                              | Placeholder or unavailable state after the in-memory content is gone        |
| Sign-in, verification, OAuth callback, logout, disconnect      | Explicit bypass; preserve normal server responses          | No cached login, callback success, or logout confirmation                   |
| Mutations and third-party requests                             | Never enqueue, cache, or silently replay                   | Connection-required result or explicit unsaved in-memory intent             |

Set explicit server/CDN cache headers too; a worker route exclusion does not configure HTTP caches.
Conversely, `no-store` headers alone do not replace an explicit prohibition on putting private
responses in Cache Storage. Include non-GET, opaque, error, and partial responses in the tests.

The offline fallback is only for a failed GET **navigation**, not a replacement JSON/audio response.
Do not mask a 401, 403, 404, or a provider failure with HTTP 200 offline HTML. Return the original
status while online. Browser `online` events are retry hints; confirm reachability with a bounded
service request before announcing reconnection.

Cold offline launch shows the neutral shell, not a fictional restored session. In an already open
page, retain volatile state and allow pause; new playback needs an available source. Nothing in
Cache Storage, IndexedDB, or local storage becomes the authority for queue or position. Reloading
may lose unsaved offline edits, and the UI says so before a voluntary reload.

Logout clears in-memory personal state and any accidental private cache entries, releases the
device's active playback claim, and invalidates the server session. The public shell may stay
installed. Offline logout stops local playback and clears local display immediately, but must not
claim server revocation succeeded; report pending revocation and retry through the normal online
flow. Disconnect remains a server-authorised operation with its existing deletion contract.

### Updates must preserve the listening session

Use the integration's **prompt-for-update** strategy, not automatic reload. A newly downloaded
worker may wait while the old app keeps playing. Do not call `skipWaiting()` automatically or
reload unconditionally on `controllerchange`; replacing the worker while clients use old assets
can break an active page. [Update prompt](https://vite-pwa-org.netlify.app/guide/prompt-for-update),
[service-worker lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)

```text
new version downloaded → waiting → owner chooses a safe update → session flush acknowledged
                              └→ later                          → activate → reload → restore paused
```

- Show a quiet "Update available" state. If audio or a save/generation action is active, default
  to Later. The owner can explicitly pause and update; installation is never a reason to stop audio.
- Before activation, resolve or surface pending writes and save the accepted resume position.
  If saving fails, defer reload rather than silently discarding the session.
- Coordinate readiness among controlled windows on the same origin. A playing or unresponsive
  client defers activation; cross-host audio ownership is handled by the session service.
- After an agreed activation, reload once, restore server state, and offer Resume. Do not try to
  defeat browser autoplay restrictions. New tabs and standalone windows must not enter reload loops.
- Keep service contracts compatible with at least the current and previous released client during
  rollout. Validate the protocol version before writes; a very old client can retain its view but
  must update before making incompatible changes.
- Retain the previous release's immutable assets for the supported client window. Treat worker
  cache cleanup and server asset retirement as separate operations; stale tabs may lazy-load a route.
- Test a production rollback with an installed newer worker. Provide a same-scope worker recovery
  release and cleanup of Halflight-owned caches; never unregister unrelated workers or clear all
  origin storage indiscriminately. A web rollback does not instantly replace an installed worker.

### PWA platform expectations

| Capability                       | Browser / installed PWA commitment                                                                 | Later native opportunity                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Launch and navigation            | Works in the browser; installed launch has owned identity and no browser toolbar where supported   | Signed app bundle and verified deep links                                 |
| Lock-screen / Bluetooth controls | Feature-detected Media Session actions, tested per device/context                                  | Platform media-session integration independent of WebView lifetime        |
| Background playback              | Observe and document actual browser behaviour; no promise that timers or a worker keep audio alive | Dedicated native playback session/service                                 |
| Offline launch                   | Neutral public shell after prior caching; no downloaded music                                      | Bundled UI still needs server access for music and accepted session state |
| Notifications / push             | Not in the first PWA release; no permission prompt on launch                                       | Add only for a named useful action, not routine engagement                |
| Audio route selection            | Use browser/OS controls where available; no universal custom output picker                         | Platform route controls after a focused spike                             |
| Background sync                  | No generation, TIDAL mutations, or position replay while the app is closed                         | Native lifecycle support still obeys reviewed actions and revision checks |

Home-screen web apps on supported iOS/iPadOS versions can support push, but that capability does
not create a product need for it. Do not use push, silent audio, wake locks, or service workers to
simulate an always-running native player. [WebKit home-screen capabilities](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Later Tauri native client

Start Tauri after the mobile website and installed PWA meet their acceptance gates. The native
client should earn its maintenance cost through playback continuity and OS integration. Initial
planning assumes iOS/Android as the mobile continuation; desktop packaging is an optional later
track, using Listening Room compositions rather than stretching the phone layout.

### Shared code and runtime separation

Tauri hosts a bundled frontend and native code; it does not run SvelteKit server loads/actions in
the app. Create a separate static frontend entry using the documented SvelteKit static-adapter
approach or a small Svelte/Vite entry if that proves simpler. Keep both production web sites on
their existing server-capable adapters. [Tauri SvelteKit integration](https://v2.tauri.app/start/frontend/sveltekit/)

```text
Listening Room web       Halflight Now web/PWA       Tauri bundled frontend
        │                        │                    │ named IPC commands
        │                        │                    ▼
        │                        │              native host / audio adapter
        └────────────────────────┴────────────────────┘
                                 │
                 authenticated Halflight service
                 owner · session revision/lease · taste
                 encrypted TIDAL tokens · audio proxy
                                 │
                              TIDAL
```

Share client-safe display types, command/reason schemas, pure session reconciliation, presentation
components, localisation, and design tokens. Keep provider access, taste computation, database,
email, and TIDAL token rotation on the server. Rust must not become a second TIDAL integration.
Do not bundle `#lib/server`, environment secrets, an embedded database mirror, or a Node server.

Extract a small playback interface when the native spike starts: load an entry, play, pause, seek,
stop, receive observed state, and report supported capabilities. The web implementation wraps the
existing media element; the native implementation invokes one platform engine. Components consume
observed state and commands, not the concrete `<audio>` element. Avoid building speculative
platform adapters before the native consumer exists.

On native, the platform engine alone owns audio position and OS media commands. The WebView can
be recreated without starting a second player. The same entry IDs, operation IDs, revisions, and
active-device epoch apply. A native session coordinator must continue the minimum required queue
advance, authentication, and server reconciliation while the WebView is suspended; a JS timer or
IPC bridge dependent on a live page cannot provide native background playback.

### Native authentication and trust boundary

Use the system browser for account authentication. Do not ask for TIDAL credentials in the app or
copy a browser's provider cookies. Evaluate Better Auth's existing **Device Authorization** plugin
for first-party device sign-in: the native host requests a short-lived code, the owner approves
the matching code in an authenticated Halflight page, and native polling completes the session.
Restrict issuance/approval to this client and the configured owner, respect polling/expiry/denial,
and regenerate the auth schema plus migration when adopting it. This is Halflight device sign-in,
separate from TIDAL's playback device grant.
[Better Auth device authorization](https://better-auth.com/docs/plugins/device-authorization)

The resulting credential is a **Halflight session**, never either TIDAL token. Keep it inside the
native authentication/network layer and, if persistent sign-in is enabled, an audited OS-backed
credential store; never expose it to WebView state, JavaScript storage, URLs, logs, or plugin-store
JSON. Verify the chosen credential-store integration on each OS before enabling persistent login;
start with memory-only native sessions during the spike. Do not invent an encryption format or
embed a decryption key in the app. Server-side owner checks still apply on every request.

Expose narrow commands such as `loadSession`, `appendTrack`, and `playEntry`, returning normalised
data and safe errors. The native network boundary authenticates these requests against a fixed
Halflight origin; it is not an unrestricted URL fetch or filesystem/shell interface. Authentication
loss revokes playback access and returns to sign-in without leaking a raw provider error.

Restrict Tauri capabilities to the bundled application window and the exact commands/plugins
needed on each platform. Do not grant a remote website or provider embed access to native IPC.
Validate command payloads in native/server code as well as the UI, constrain external navigation,
and keep CSP/connect/media origins explicit. [Tauri capabilities](https://v2.tauri.app/security/capabilities/)

### Native audio feasibility comes before packaging polish

| Platform         | Preferred existing foundation                                                            | Required integration                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Android          | AndroidX Media3 ExoPlayer + `MediaSessionService`                                        | Background service lifecycle, audio focus, interruptions, route changes, system controls, queue progression, authenticated requests  |
| iOS              | AVPlayer/AVQueuePlayer + AVAudioSession and system Now Playing/remote commands           | Playback audio-session configuration, background audio mode, interruptions, route changes, queue progression, authenticated requests |
| Optional desktop | Start by measuring the system WebView engine; add platform integration only where needed | Media keys, suspend/resume, window-close versus quit, output support, OS-specific codec behaviour                                    |

Media3 supplies an established background media-service architecture; Apple's media frameworks
provide the playback/session foundations. Tauri's mobile plugin mechanism bridges Kotlin/Swift
implementations to the shared frontend. These reuse platform audio engines rather than implement
codecs or decoding in Rust/JavaScript. [Android background playback](https://developer.android.com/media/media3/session/background-playback),
[Apple media playback configuration](https://developer.apple.com/documentation/avfoundation/configuring-your-app-for-media-playback),
[Tauri mobile plugins](https://v2.tauri.app/develop/plugins/develop-mobile/)

The first native spike must play a synthetic stream and an owner-tested permitted TIDAL stream
through Halflight's authenticated proxy, seek with Range, survive lock/background, advance to the
next track while the WebView is suspended, and handle credential expiry. Prove a supported native
HTTP authentication path for both platforms before promising production playback; do not solve
cookie/header difficulties by putting a token in a media URL or exposing a provider CDN address.

The native layer requests track identifiers and receives playback through the fixed Halflight
service. Bound in-memory buffers, retain the existing quality fallback, and report the format
actually decoded. Native codec support is not identical to browser support. If direct playback
cannot be supported, show an honest reconnect/open-in-TIDAL fallback; a browser embed is not a
transparent substitute for native background audio. No downloads, durable audio cache, background
library syncing, or offline catalogue are added by this phase.

### Native packages, deep links, and releases

| Dependency                                         | Adoption purpose                                                | Boundary                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@tauri-apps/api`, `@tauri-apps/cli`, Rust `tauri` | Tauri host, IPC, builds                                         | Pin compatible versions in pnpm/Cargo lockfiles; separate native build output             |
| `@sveltejs/adapter-static`                         | Bundle a client-only SvelteKit frontend if that entry is chosen | Native entry only; no server loads or secrets in its output                               |
| `@tauri-apps/plugin-deep-link`                     | Verified app links and cold/warm route delivery                 | Parse allowed hosts/paths/IDs; opening a link never authorises a write or starts playback |
| `@tauri-apps/plugin-opener`                        | Open sign-in/help/provider destinations in the system browser   | Explicit HTTPS destination allowlist; no arbitrary command execution                      |
| `@tauri-apps/plugin-haptics`                       | Optional feedback matching mobile web actions                   | Capability-gated; never required to understand an action                                  |
| `@tauri-apps/plugin-updater`                       | Evaluate for a later signed desktop distribution                | Mobile release channels are planned separately; no universal updater assumption           |
| AndroidX Media3 / Apple media frameworks           | Native playback mechanics and OS controls                       | Integrate behind the small player interface; no second source of queue truth              |

Use the corresponding Rust plugin crates with compatible versions. Verify target support and
permissions for each plugin during adoption, including credential storage; do not choose an
unmaintained community player wrapper just because its demo plays one URL.
[Deep-link plugin](https://v2.tauri.app/plugin/deep-linking/),
[Opener](https://v2.tauri.app/plugin/opener/), [Haptics](https://v2.tauri.app/plugin/haptics/),
[Updater](https://v2.tauri.app/plugin/updater/)

Keep HTTPS mobile routes as canonical links. When native linking ships, serve verified Android
App Links and Apple Universal Links association files for the approved paths, with the website as
fallback when the app is absent. Test cold launch, already-running app, cancelled sign-in, and
malformed links. A deep link carries an object identifier, not a session credential or executable
action; use the authenticated app to resolve it.

Build and sign on the appropriate platform toolchains. Start with owner-only internal/test
distribution, then choose a maintained delivery channel per OS; public store listing is not a
prerequisite for this single-owner product. Document signing-key custody, provisioning expiry,
version/build numbers, rollback, supported OS versions, and at least previous-client API
compatibility. OS/toolchain/store requirements must be rechecked at release, not frozen from this
planning document. Never make a web deployment silently replace privileged native executable code.

For optional desktop delivery, reuse Listening Room where it fits, define whether closing a window
continues playback, reserve explicit Quit to stop/release it, and test suspend/resume and one
instance per device. Global shortcuts, tray controls, autostart, and updater each need a named
owner workflow; mobile release does not wait for desktop packaging.

## Mobile, PWA, and native release gates

Plan device coverage as Safari on iPhone and Chrome on Android for the initial web/PWA release,
plus a small iPad/tablet sanity pass. At delivery, record actual OS/browser versions, physical
devices, quality tiers, and known limitations; feature-detect rather than infer support from a UA.

| Gate                          | Deliverable                                                                                       | Evidence required                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M0 — session contract         | Stable entries, conflict reconciliation, active-device semantics, same-origin mobile backend path | Two-client race, duplicate response, takeover, auth expiry, Range/seek tests                                                    |
| M1 — mobile website           | Home, Now, queue, search, library, mobile details, concise generation/review, Settings            | Full touch/keyboard journey; EN/DE; 320px, zoom, landscape, virtual keyboard; physical-phone audio smoke                        |
| P0 — installable shell        | Manifest, owned icons, install/help UI, allowlisted worker caches, neutral offline route          | Real installation on both targets; inspect caches; cold offline start; logout/relogin; API/audio bypass tests                   |
| P1 — PWA updates and recovery | Waiting-worker UI, save-before-update, safe resume, stale-client handling, rollback               | Deploy v1→v2 while playing in multiple windows; defer/apply; rejected save; offline and rollback scenarios                      |
| N0 — native feasibility       | Bundled entry, narrow bridge, native authentication and one audio engine per platform             | Background/lock, next-track advance with suspended WebView, seek, expiry, reconnect, device takeover, no credential/CDN leakage |
| N1 — native daily use         | Shared mobile journeys with OS playback controls, deep links, signed internal distribution        | Calls/audio focus/headphone changes; process death; upgrade; logout/revoke; real devices and native UI tests                    |
| N2 — optional desktop         | Desktop composition, media keys, window lifecycle, signed update path                             | Target-OS codec/playback, suspend/resume, close/quit semantics, signed update/recovery                                          |

Automate mobile layouts and service-worker policy with Playwright against a built production
preview. Use synthetic fixtures to assert that Cache Storage contains only allowlisted assets and
that no authenticated route is served offline. Test the media element actually advancing, not
just an icon changing. Use VoiceOver/TalkBack and actual install/lock-screen flows manually on
physical phones; desktop WebKit emulation does not prove iOS PWA or native lifecycle behaviour.

For native, reuse Vitest for pure shared logic and UI state, add Rust tests for validated IPC and
service contracts, and use platform tests for audio/background lifecycle. Keep separate web/PWA
and native release acceptance records. Do not turn emulator success into a guarantee about
battery, interruptions, codecs, or background execution on real devices.

Operational acceptance includes play-to-audio and seek latency by quality, resume correctness,
worker update outcome, bounded cache size, long-session memory/battery observation, and redacted
failure counts. A worker/package/native experiment is successful only if it improves one of these
outcomes without violating the session, accessibility, or provider boundaries.

## Technical architecture

### One service, two site deployments

`halflight.eu` and `m.halflight.eu` are independently deployed SvelteKit front ends over the same
owner account, Postgres state, TIDAL access layer, and purpose-built server capabilities. This is a
product boundary, not two competing back ends. The first implementation may keep the current Syn
repository and extract shared modules incrementally; it must not pause product work for an eager
monorepo rewrite.

```text
Listening Room                  Halflight Now
halflight.eu                    m.halflight.eu
      │                                 │
      └──────────────┬──────────────────┘
                     ▼
          shared Halflight server boundary
  owner auth · session arbitration · taste · TIDAL · stream proxy
                     │
              Postgres + optional approved working storage
```

- **Share domain logic, never whole layouts.** Display models, player/session protocol, server
  implementations between server deployments, i18n messages, design tokens, and accessible primitives may be shared. Shells, routes,
  navigation, responsive CSS, page compositions, and interaction state are site-owned.
- **Keep trust boundaries intact.** Both hosts authenticate on the server; neither receives TIDAL
  tokens, stream URLs, or bucket credentials. OAuth transaction and encrypted TIDAL cookies remain
  narrow, HttpOnly, Secure, SameSite=Strict, and explicitly expired. Establish session continuity
  across the two hosts deliberately, with tests, rather than widening token-cookie scope by habit.
- **Give rotating tokens one refresh authority.** The current module-level single-flight guard
  coordinates one process only. Prefer routing provider access and refresh through the shared
  service. If multiple processes must refresh directly, add cross-process serialization and
  version-checked token persistence; test simultaneous expiry and disconnect during refresh.
  Sharing a database or installing a request queue alone does not prevent rotation races.
- **Make session changes ordered.** Build on the server-assigned session revision and action origin
  in `playback_state`. Updates use optimistic concurrency: assign the next revision, return the latest
  session on conflict, and let the client reconcile visibly only when necessary. This protects a
  queue edited on desktop while the phone is open.
- **Deep links are host-aware.** Catalogue and product objects retain canonical identifiers. Each
  host renders its best available view; a mobile page can offer “Open in Listening Room” for deep
  curation without breaking a shared session.
- **Deploy and observe separately.** Each site gets its own performance budgets, error boundary,
  analytics-free safe operational events, release smoke tests, and rollback path. Service health,
  persistence, and provider access are shared and measured once.

### Route and data boundary

- `+page.server.ts` loads credentialed data and returns purpose-built view models.
- Named form actions and `/api/**` handlers own mutations, returning typed success/failure data.
- Client JavaScript handles enhancement, focus, pending state, and the player engine — never token
  handling or duplicated server domain logic.
- `src/lib/server/` is the only code that knows tokens and upstream API details.

### Normalisation layer

```text
src/lib/server/tidal/
├── api.ts          endpoint wrappers (incl. relationship traversal)
├── jsonapi.ts      protocol helpers
├── normalise.ts    JSON:API resource → display model
├── stream.ts       manifest parsing + quality ladder
├── segmented.ts    DASH fragment concatenation + Range
├── load.ts         loadTidalPage() page-load wrapper
└── errors.ts       safe domain error taxonomy
```

Display contracts live in `src/lib/tidal/models.ts` (client-safe, pure types). Add a field only when
a screen uses it and its upstream shape is verified.

### Taste engine architecture

Extend the existing server modules using the established `*Store` + injected-dependency pattern so
every stage remains unit-testable with no DB and no network.

```text
src/lib/server/taste/
├── signals.ts      live readers over the TIDAL client → raw signal set
├── profile.ts      TasteProfileStore interface + dbTasteProfileStore + merge/decay logic
├── graph.ts        budgeted expansion over TIDAL relationship edges
├── candidates.ts   pool assembly, ISRC dedupe, filters, cooldown
├── score.ts        pure scoring: affinity / novelty / fit / penalties
├── sequence.ts     energy arc, spacing, opener/closer
├── explain.ts      provenance labels + set summary
└── generate.ts     the orchestrator; takes knobs + ctx, returns a provisional set
```

Rules:

- `score.ts`, `sequence.ts`, and `explain.ts` are **pure** — arrays in, arrays out. They carry the
  bulk of the test suite and need no fixtures beyond plain objects.
- `graph.ts` and `signals.ts` take an injected TIDAL client and use hand-authored synthetic fixtures.
- `generate.ts` must enforce the request budget and wall-clock ceiling. Partial candidates return
  a shorter set with lower confidence; zero eligible candidates return an honest empty result.
- The current generation action returns a completed result. Real streamed progress and cancellation
  are planned work, specified in **Implementation contracts and delivery gates**.

### API wrapper evolution

- Keep `tidalFetch` / `tidalJson` as transport primitives.
- Expand typed helpers only for committed workflows — the engine will drive most new ones.
- Validate mutation inputs before calling TIDAL: non-empty IDs, supported types, batch caps, string
  length limits.
- Preserve one-shot 401 refresh; do not auto-retry non-idempotent requests.
- **Fetch the media CDN with the global `fetch`, never `event.fetch`** — SvelteKit's wrapper
  attaches request context that the CDN rejects.
- Forward a correlation ID through logs and error states without logging bodies.

### Persistence

Persist only:

- The encrypted TIDAL authorization records (browse + playback).
- Better Auth data.
- Halflight-owned preferences: streaming quality, volume, normalisation, layout booleans.
- Bounded workflow state: the resumable queue, history, and position.
- **The derived taste profile** — weights, identifiers, knob defaults, exclusions, timestamps.

Do not persist catalogue, artwork, playlist, or listening-history mirrors. Optional storage experiments must satisfy the gates in **Object storage** below; they do not
create a general retention exception.

## Local Redis cache and coordination

**Use the existing `REDIS_CACHE` service.** The local environment contains an authenticated
loopback Redis URL; source inspection found no application declaration/client yet. This is a
configuration observation, not a Redis connectivity, version, persistence, or capacity test.
Do not copy the URL into documentation, logs, command arguments, or generated artifacts.

Redis is shared, disposable server working memory. Postgres remains authoritative for the owner,
encrypted TIDAL tokens, accepted playback session, operation deduplication, profile versions,
exclusions, and local playlists. A Redis restart must not lose any accepted user action.

### Integration and topology

- Declare `REDIS_CACHE` in `src/env.ts` using the existing optional-variable pattern, import it
  from `$app/env/private` only in `src/lib/server/`, and add a non-secret placeholder to
  `.env.example` in the implementation slice. Missing configuration disables optimisations with
  an honest health state; it must not stop the shell or existing direct playback.
- The key is literally `REDIS_CACHE`; Markdown backslashes are not part of the key or URL.
  Validate connection-string parsing with synthetic credentials containing Unicode and reserved
  characters. Percent-encode the credential component when required by URL syntax, never the
  whole URL, and never double-encode an already escaped password or print a parse failure's input.
- Adopt the **`redis` package (node-redis)** as the single Redis client. Create a lazy, reused
  connection per long-lived server process with an error listener and a shared connection promise.
  Avoid connecting on every request, at build time, or from browser-reachable modules.
  [Official Node client](https://redis.io/docs/latest/develop/clients/nodejs/)
- Keep the Redis server local to the shared Node/PM2 service. `localhost` inside another machine,
  container, or Vercel function is not this Redis instance. Route remote web deployments through
  the authenticated Halflight backend, or explicitly provision a private network path. No public
  Redis port and no credential in mobile/native configuration.
- Apply short connect/command deadlines and bounded backoff with jitter. Proposed local targets:
  500 ms to connect and 100 ms for ordinary cache operations, tuned after measurement. Disable
  disconnected-command queuing so a recovered connection cannot replay stale coordination work.
  Verify the exact selected client's timeout/abort behaviour; `Promise.race` alone does not cancel
  a command. [Node Redis production usage](https://redis.io/docs/latest/develop/clients/nodejs/produsage/)
- Use one additional connection for a subscriber only when server-sent session notifications ship.
  Set connection limits and close owned connections on graceful shutdown. Never delay an audio
  byte stream on cache work or issue Redis commands per audio chunk/timeupdate event.

```text
web / installed PWA / later native
               │ HTTPS product commands and audio
               ▼
       shared Halflight Node service
          ├── Postgres: authority, durable state, token rotation
          ├── REDIS_CACHE: derived cache, request limits, revision hints
          └── TIDAL: server-only access and proxied playback
```

### First consumers, keys, and bounds

Use an explicit namespace such as `syn:<environment>:v1:<owner-key>:…`, with separate prefixes
for cache, admission, and notifications. Do not encode email addresses, search queries, titles,
tokens, or the Redis URL in keys. The owner key is an internal opaque identifier, not a tenancy
feature. Payloads have a schema/version and are validated on both write and read.

| Consumer                             | Stored value                                                                                                       | Initial bound / invalidation                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Generation pool reuse                | Track/artist IDs, derived scores, reason codes, coverage, profile revision, input digest, authorization generation | 5-minute TTL, maximum 3 pools and 256 KiB serialized per pool; profile/exclusion/auth changes invalidate |
| Request admission                    | Counters and reset time for provider-wide and optional-work limits                                                 | Short windows aligned with the generation budget; explicit expiry; no catalogue data                     |
| Provider cooldown                    | Safe retry-until time derived from a 429 response                                                                  | Fixed expiry, capped by the operation policy; never reset by each request                                |
| Duplicate generation suppression     | Random holder ID and run ID for identical in-flight requests                                                       | Short lease bounded by the run deadline; cache optimisation only, never proof of mutation ownership      |
| Session revision notification        | Owner key, committed revision, safe origin, message schema version                                                 | Pub/Sub event only; no queue, title, playback credential, or durable event history                       |
| Optional derived profile computation | Versioned derived weights for an already-authorised operation                                                      | At most one short-lived entry per profile revision; re-read the authoritative revision for mutations     |

Do not cache TIDAL API documents, rendered catalogue pages, search results, artwork, lyrics, audio,
stream URLs, HTTP auth sessions, OAuth transactions, or token material in Redis. Keep provider
display enrichment request-scoped and live. Pool reuse saves expansion/scoring work; its IDs still
need live display/availability resolution within the request budget before review/play/save.

A pool key covers algorithm version, profile content revision, canonical seeds/knobs, region or
availability context, and authorization generation. Invalidation follows the **Postgres commit**.
Versioned keys prevent a late writer from making an old result current; expired/invalid payloads
are a cache miss, never a reason to serve stale exclusions or authorization.

### Shared admission without sacrificing playback

Pair `p-queue` for local pacing/concurrency/priority with **`rate-limiter-flexible`'s atomic Redis
limiter** for shared request admission. Use its node-redis integration, not the non-atomic variant;
verify scripts and minimal ACL commands against the installed Redis version. These tools serve
different purposes: neither a local queue nor a shared counter alone is a complete scheduler.
[Redis limiter integration](https://github.com/animir/node-rate-limiter-flexible/wiki/Redis)

Count requests at the shared provider boundary, including pagination, retry, and enrichment. An
overall account limit includes playback-related API resolution, while a stricter optional-work
limit leaves headroom for user playback. Audio bytes themselves bypass the limiter. Budget expiry
or denied admission produces a bounded partial generation, not a growing queue of delayed jobs.

Limiter keys must not be casually evicted: disappearing counters can admit a fresh burst. Before
shared admission goes live, inspect the existing instance's memory/eviction/persistence policy
without changing it blindly. A separate Redis logical database does not isolate memory eviction.
If the instance is shared or evicts all keys, keep correctness-independent caches there and retain
admission in the single service/Postgres fallback until a suitable isolated instance is available.
For a dedicated instance, prefer `noeviction` with explicit application cache caps and expiry;
handle refused writes as degraded operation. [Redis eviction policies](https://redis.io/docs/latest/develop/reference/eviction/)

Redis admission is still a best-effort external-API protection mechanism across server restarts.
On a cold restart, begin conservatively rather than spending a fresh burst immediately. Respect
upstream 429/Retry-After independently. If Redis is unavailable, suspend new optional expansion,
use valid request-local candidates, and keep only the centrally paced essential playback path.
Multiple disconnected processes must not each invent their own full fallback allowance.

### Session notifications and loss recovery

After a successful Postgres session commit, publish the new revision. A server subscriber may
notify authenticated SSE clients to refetch or reconcile that revision; initial mobile delivery
can keep polling until this reduces measured latency/load. A publish failure must not turn a
successful database write into a failed user action or trigger a duplicate mutation.

Redis Pub/Sub is **at-most-once**, so use it as an invalidation hint, never as an authoritative
queue-command stream. A client connects, subscribes, reads a current snapshot, and applies only
newer revisions; it periodically reconciles and always refetches on reconnect/focus. Lost events
or Redis restart fall back to polling Postgres. No event replay guarantee is needed for the initial
single-owner product. [Redis Pub/Sub delivery semantics](https://redis.io/docs/latest/develop/pubsub/)

Playback-device leases, revocation, duplicate write detection, and rotating-token safety stay in
the existing authoritative service/Postgres transaction boundary. An expiring Redis lock is not
sufficient for these: it can expire while its holder is still working. For optional computation
suppression, compare the holder ID before releasing a lease, bound the wait, and tolerate duplicate
calculation. Never use a Redis cache lock to justify concurrent refresh of either rotating TIDAL token.

### Operations, failure behaviour, and adoption sequence

Inspect server version, authentication, reachability from the app process, memory ceiling, eviction,
ACL permissions, and snapshot/AOF retention in a read-only deployment check. Redis may be durable
on disk even when used as a cache: TTL is not proof that values vanish from backups immediately.
The owner-data deletion runbook must account for any retained snapshots; avoid unnecessary derived
profile copies and never introduce Redis copies of provider secrets.

Keep cleanup limited to Halflight's exact namespace with bounded scanning/deletion. No `KEYS *`,
`FLUSHDB`, `FLUSHALL`, broad config changes, or debug payload dumps on the shared service. Log only
safe operation category, latency, hit/miss/error counts, and aggregate bytes; never keys or values.

| Failure                                     | Behaviour                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Redis unavailable / command times out       | Skip caches, stop new optional provider expansion, retain DB session writes and essential paced playback     |
| Corrupt, expired, or oversized pool         | Drop it and recompute within budget; no partial deserialization into UI                                      |
| Memory cap / refused cache write            | Return the successfully computed result without caching; no increased memory ceiling                         |
| Lost notification / subscriber reconnect    | Re-read authoritative session state and resume polling                                                       |
| Disconnect races a pending cache write      | New authorization generation makes it unreadable; delete namespace entries asynchronously with bounded retry |
| Postgres unavailable while Redis is healthy | Do not acknowledge durable writes or use stale Redis as authorization; existing buffered audio may continue  |

First implementation slice: add the server-only client and injected cache interface, then one
generation-pool consumer with TTL/size/invalidation tests. Second: shared admission with failure
policy and synthetic multi-process concurrency tests. Third, only after mobile polling measurements:
revision Pub/Sub → authenticated SSE, with dropped-event and reconnect tests.

Use an isolated disposable Redis instance for integration tests of expiry, script atomicity,
restart, and refused writes; unit tests inject an in-memory adapter and fake clock. Do not flush or
reconfigure the owner's `REDIS_CACHE` to test outages. Document commands/config keys, not live values.

Do not add BullMQ merely because Redis now exists. The local cache's durability/eviction contract
is not automatically suitable for jobs; BullMQ expects its Redis storage not to evict queue keys.
Keep `pg-boss` the conditional durable-job choice for now, and reassess one job system only when a
real job requires it. [BullMQ connection and eviction requirements](https://docs.bullmq.io/guide/connections)

## Third-party packages and reuse decisions

Use established packages for interaction mechanics, validation, scheduling, and test infrastructure.
Halflight owns session semantics, provider boundaries, taste scoring, and explanations. A dependency
should remove maintained code or deliver a named capability in the same slice that introduces it.
This is an adoption plan, not a bulk installation list.

### Reuse what is already installed

Inventory source: `package.json`. Some runtime libraries currently sit in `devDependencies`; keep
deployment packaging in mind without turning feature work into an unrelated dependency reshuffle.

| Existing foundation           | Use it for                                                                     | Implementation boundary                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| SvelteKit + Svelte 5          | Server loads/actions, progressive forms, routing, runes, transitions           | Extend the current player state class; keep browser lifecycle code out of SSR    |
| Better Auth                   | Owner identity, sessions, verification and sign-in lifecycle                   | Extend existing hooks; preserve separate server-only TIDAL authorization flows   |
| Drizzle + `postgres`          | Owned state, conditional session updates, transactions, migrations             | Use the existing injected stores; avoid a second ORM or generic repository layer |
| Paraglide                     | Both locales, action errors, generation explanations, accessible announcements | Store reason codes and safe parameters; render prose through message keys        |
| `@lucide/svelte`              | Consistent control and status icons                                            | Keep visible or accessible labels; avoid another icon system                     |
| `nodemailer`                  | Verification mail through the existing Postfix relay                           | Extend `src/lib/server/email.ts`; keep SMTP protocol logging disabled            |
| `web-haptics`                 | Optional tactile feedback for deliberate mobile actions                        | Capability-gated enhancement; visible and keyboard feedback remain sufficient    |
| Vitest, Storybook, Playwright | Pure logic, browser components, reusable states, full workflows                | Add coverage in the existing projects and synthetic fixtures                     |

Nodemailer's SMTP transport already supplies submission, TLS options, timeouts, and connection
pooling. Keep the existing small text/HTML template until email complexity warrants a template
library. A Vercel function cannot reach this host's Postfix via its own `127.0.0.1`; launch mail from
the colocated Node deployment or explicitly provision a secure relay path before enabling it on
another runtime. [Nodemailer SMTP documentation](https://nodemailer.com/smtp)

### Preferred additions when their slice starts

| Package                                                                           | Concrete use and code it replaces                                                                      | First integration and acceptance gate                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`bits-ui`](https://www.bits-ui.com/docs)                                         | Headless dialogs, menus, tabs, comboboxes, and sliders; replaces repeated focus and keyboard machinery | Wrap one playlist dialog and track-action menu in `components/ui/`; verify focus return, Escape, keyboard operation, SSR, and existing theme tokens      |
| [`valibot`](https://valibot.dev/guides/introduction/)                             | Runtime schemas with inferred types; replaces repeated shape checks and unsafe numeric coercion        | Start with generation knobs and new session commands; reject non-finite numbers, oversized arrays, invalid revisions, and unsupported actions before I/O |
| [`p-queue`](https://github.com/sindresorhus/p-queue)                              | Concurrency and interval-based request scheduling; replaces ad hoc request timers                      | Add a server-only scheduler around graph/enrichment reads; verify cancellation, priority, pacing, and a shared budget under concurrent runs              |
| [`svelte-dnd-action`](https://github.com/isaacHagoel/svelte-dnd-action)           | Pointer, touch, and keyboard sorting; replaces custom drag geometry and drop handling                  | Queue editing first; commit final order once, preserve the playing item, and retain explicit Move up/down actions                                        |
| [`fast-check`](https://fast-check.dev/docs/introduction/) (dev)                   | Generated inputs and shrinking for invariant tests                                                     | Exercise queue commands, ISRC dedupe, exclusions, and deterministic ordering in Vitest; retain the failing seed for reproduction                         |
| [`@axe-core/playwright`](https://playwright.dev/docs/accessibility-testing) (dev) | Automated accessibility checks of complete rendered journeys                                           | Scan dialog-open, queue, generator-error, and mobile-player states; supplement with manual keyboard and screen-reader checks                             |

Bits UI's current component model targets Svelte 5; use its current documentation and snippets,
not examples from the old v0 API. Keep Halflight's visual design in semantic tokens and small local
wrappers. Adopt one primitive at a time rather than replacing the whole UI. [Bits UI migration guide](https://www.bits-ui.com/docs/migration-guide)

Redis/PWA additions now have named consumers: `redis` and `rate-limiter-flexible` support the
[local Redis slice](#local-redis-cache-and-coordination); `@vite-pwa/sveltekit` and the needed Workbox
modules support the [installed PWA](#the-installed-pwa). Tauri dependencies remain in the
[later native plan](#later-tauri-native-client) until N0 begins. Do not install these all at once.

### Conditional additions

| Package or tool                                                                                                            | Introduce only when                                                                                   | Limits and alternative already available                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`sveltekit-superforms`](https://superforms.rocks/get-started/valibot)                                                     | Full generator/profile forms repeat field errors, nested values, dirty state, and submission handling | Pair with Valibot; keep simple one-action forms on SvelteKit's existing enhancement                                                                                |
| [`@tanstack/svelte-virtual`](https://tanstack.com/virtual/latest/docs/framework/svelte)                                    | A measured long library list exceeds its render/scroll budget                                         | Keep cursor pagination; test focused rows, screen-reader position, dynamic heights, and current Svelte compatibility; the bounded queue does not need it initially |
| [`lru-cache`](https://github.com/isaacs/node-lru-cache)                                                                    | Several request-scoped caches need common size/eviction semantics                                     | Server-only, explicit `maxSize` and TTL, no stale results after disconnect; it is neither durable state nor a cross-process cache                                  |
| [`msw`](https://github.com/mswjs/msw) (dev)                                                                                | HTTP fixtures are duplicated between component/Storybook integration tests                            | Reuse synthetic handlers; retain injected clients for pure tests and Playwright routing for browser requests; intercept SSR requests in the server test process    |
| [`pg-boss`](https://github.com/timgit/pg-boss)                                                                             | An approved task must survive request completion or process restart                                   | Use existing Postgres plus a separately operated worker; budget its connection pool, migrations, retries, and retention; avoid building a custom durable scheduler |
| [`@aws-sdk/client-s3`](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html) | An approved storage use needs an S3-compatible bucket                                                 | Server-only put/get/delete behind `bucket.ts`; verify the chosen provider's Range/lifecycle behaviour; no browser credentials or media URL redirects               |
| [FFmpeg / ffprobe](https://ffmpeg.org/ffmpeg.html) (worker binaries)                                                       | A verified container incompatibility requires an approved remux experiment                            | Pin the worker image, use stream copy, bound CPU/memory/time, and verify codec support; container changes cannot make an unsupported codec decodable               |
| [`wavesurfer.js`](https://wavesurfer.xyz/)                                                                                 | Approved precomputed peaks demonstrably improve seeking                                               | Lazy-load against the existing media element and supplied peaks/duration; preserve a semantic seek control and prevent a second download or audio engine           |

`pg-boss` manages durable job mechanics, but each handler must still tolerate a retry after a crash
between an external effect and recording completion. Store identifiers and safe job status only,
re-read credentials at execution, and purge completed payloads promptly. A Postgres queue does not
give a serverless request an unlimited runtime. [pg-boss documentation](https://github.com/timgit/pg-boss)

Do not add `fluent-ffmpeg`: its upstream repository is archived and marks the package deprecated.
If the remux experiment is justified, invoke the maintained FFmpeg binary with a fixed argument
array through Node's process API; never construct a shell command from provider data.
[fluent-ffmpeg upstream notice](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)

### Dependency admission and upgrade policy

1. Name the first consumer, the custom code removed, and the rollback path. Add only that slice's
   runtime/dev dependencies with pnpm; commit the resulting lockfile.
2. At installation, inspect the exact release's engine/peer requirements, license, maintenance,
   advisories, transitive packages, and install scripts. The recommendations above are architectural
   choices, not claims that an untested release is compatible or vulnerability-free.
3. Prove SSR and browser behaviour against this repository's SvelteKit `next`, Svelte runes, strict
   TypeScript, and production adapter. Test both adapters when the shared server boundary changes.
4. Measure added client JavaScript and lazy-load optional feature code. Secrets and Node-only
   packages must remain unreachable from the browser bundle.
5. Avoid overlapping primitives, schema libraries, state stores, or HTTP retry layers. Keep the
   TIDAL client and token-refresh policy authoritative; a generic SDK is not a replacement for the
   verified browse/playback split.
6. Keep native `fetch`, `AbortController`, `URL`, `Intl`, Svelte transitions, and the current
   `HTMLAudioElement` where they already solve the problem. A short domain rule is appropriate
   custom code; an independent focus manager, retry scheduler, or job runner usually is not.

## Implementation contracts and delivery gates

These are proposed increments over today's code. Numeric budgets below are initial engineering
targets, not measured production results or published TIDAL rate limits.

### 1. Session reconciliation before a second site

**Existing foundation:** `playback-state.ts`, `/api/playback-state`, revision/origin columns, and
the player's debounced persistence. The API already returns HTTP 409 on a stale revision; the
client currently consumes the returned revision without reconciling the returned queue.

- Keep the server authoritative. Evolve snapshot writes toward named intents carrying
  `expectedRevision`, `operationId`, `origin`, and a typed payload. Accept a mutation and increment
  the revision atomically; a conflict returns the current state without applying the stale intent.
- Give every queue occurrence a stable entry ID separate from its TIDAL track ID. The same track
  can appear twice deliberately; reorder/remove must identify the intended occurrence.
- Serialise client writes. Coalesce position updates, preserve deliberate edits, and never attach
  a newer revision to an old snapshot and resend it. On conflict, refresh and rebase safe intents;
  queue replacement asks the owner to resolve a meaningful conflict.
- Maintain a bounded set of recent operation IDs with results to handle retries after a lost
  response. Keep this in the same transaction as the state write; prune it by count and age.
- Distinguish the **controller** from the **device playing audio**. Introduce a server-issued
  playback lease/epoch for one active device; only it persists position. A remote queue edit must
  not start another audio element. Explicit "Play here" takes over, with a gesture for autoplay
  rules and reconciliation when a sleeping device returns. Do not promise zero overlap while a
  disconnected old device can still play buffered audio.
- Start live state reads with visibility-aware polling: a provisional 2-second interval while the
  controller is visible, immediate refresh on focus/reconnect, and backoff on failure. Measure DB
  reads and latency before moving to SSE. Neither polling nor an event connection owns playback.
- `BroadcastChannel` may coordinate tabs on the same origin; it cannot connect `halflight.eu`
  to `m.halflight.eu`. Cross-host state flows through the authenticated server boundary.
  [Broadcast Channel scope](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)

**Gate:** two browser contexts race an edit, duplicate a request, lose a response, reconnect, and
take over playback. Exactly one accepted revision wins; no entry disappears, a remote position
update never seeks the local audio unexpectedly, and ordinary navigation preserves playback.
Reuse Drizzle transactions, Valibot, and native browser APIs; no realtime service or CRDT is needed.

### 2. Accessible queue and review controls

Start with a Bits UI playlist dialog and track-action menu, then the queue's `svelte-dnd-action`
integration. Keep the existing `components/ui`, `components/music`, and `components/player` split.

- Expose one set of commands: play now, play next, append, remove entry, reorder, clear, and save.
  Domain functions own these commands; components invoke them through buttons, menus, or dragging.
- During dragging, update a local preview. Persist on finalisation; cancel restores the last
  accepted order. Disable ambiguous concurrent edits or reconcile them through the session contract.
- Restore focus to the moved item, announce its new position through Paraglide, and keep Move
  up/down buttons available. Include duplicate tracks, scrolling, long German labels, zoom, and
  touch cancellation in the interaction checks.
- Saving a local set and publishing to TIDAL are separate named actions. Publishing shows the
  destination, ordered tracks, and expected effect before submission; partial success stays visible.

**Gate:** keyboard-only queue editing and playlist review work while audio continues; automated
axe checks pass for representative open states, and focus/announcements receive manual review.

### 3. Bounded generation with truthful progress

Extend `graph.ts` and `generate.ts` rather than creating another generator. Start with the existing
15-request graph cap and fan-out of 5. Proposed initial additions: at most 2 concurrent reads,
2 starts per second, a 20-second generation deadline, and a 5-second per-read timeout capped by
the remaining deadline. Re-tune from observed safe timings and 429 responses.

- Use `p-queue` for pacing and priority. The account's browse and enrichment traffic must share
  admission control; playback resolution gets priority. A module-local queue only governs one
  process. Centralise provider scheduling at the shared service and use Redis admission only under
  the memory/failure contract in **Local Redis cache and coordination**; do not assume a global
  limit from local instances. Postgres remains the fallback for correctness-sensitive coordination.
- Charge pagination, enrichment, retries, and extra relationship hops to the budget. Keep OAuth
  refresh in its existing single-flight flow and reserve capacity for playback. Abort fetches when
  the run is cancelled or its deadline expires; a queue timeout alone does not stop network I/O.
- Honour `Retry-After` for 429 responses, including HTTP-date values. Wait only within the remaining
  deadline; otherwise return the valid partial pool. Retry only safe reads, with a capped attempt
  count. Existing one-shot 401 refresh remains separate from transport retry policy.
- Use a POST response stream for actual stage events through a SvelteKit endpoint using native
  streams. Events carry `runId`, sequence number, stage code, counts, and elapsed time; a terminal
  event carries the normalised result or safe error. Localise stage labels in the UI; do not fake
  a percentage when the amount of work is unknown.
- Client cancellation aborts the stream and upstream work. A newer run supersedes the old one;
  stale responses cannot replace a current preview. Retain a non-streamed form-action fallback
  that invokes the same orchestrator. Verify proxy buffering and request lifetime on each adapter.
- Derive a reproducible input key from profile revision, algorithm version, sorted seeds, knobs,
  availability context, and an injected clock. Break score ties by stable identifiers and process
  parallel results in canonical order. If reshuffle is introduced, use an explicit seed.
- Missing BPM, popularity, key, or ISRC is missing evidence, not zero. Track coverage/confidence
  and redistribute applicable score weights. Never substitute an invented genre or mood field.
- A run with no eligible tracks preserves the existing queue and offers revised constraints. A
  shorter result names the limiting constraint. Previewing never writes to TIDAL.

**Gate:** injected slow, empty, malformed, 401, and 429 responses cannot exceed the budget, leak a
provider body, or replace a newer run. `fast-check` verifies exclusion, uniqueness, bounded length,
stable ordering, and input immutability across generated cases. Retire the legacy generator only
after the consolidated workflow covers its useful presets and has a tested fallback.

### 4. Owned data, cooldown, and resumable writes

Use targeted Drizzle migrations for each feature; the following are proposed contracts, not a
request to create all these tables immediately.

| Owned state                | Minimum shape                                                                             | Bound and invalidation                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Session protocol additions | Stable queue-entry IDs, active-device epoch/lease, recent operation results               | Preserve the existing 100-item queue and 50-item history caps; no accumulating event log |
| Profile evolution          | Schema version, separate content revision, derived weights, overrides, reason codes       | Rebuild or migrate old versions deliberately; reset/export/delete remain available       |
| Generation cooldown        | Track ID and expiry, upserted when a set is accepted                                      | Proposed maximum 500 IDs and 30 days; no titles, play timestamps, or append-only history |
| Local playlist             | Owner-written name/description, ordered track IDs, optional TIDAL ID and safe sync status | Retain as owned work until deleted; resolve provider display fields live                 |
| Pending TIDAL operation    | Operation ID, reviewed input digest, remote ID if known, chunk progress, safe status      | Proposed 24-hour recovery window, then reconcile or expire; no tokens or raw responses   |

Keep full display pools in request memory initially. If rapid reruns need reuse, start with a
bounded server cache; cross-process snapshots may retain only IDs, derived scores, reason codes,
input version, and expiry. Rehydrate current display data and recheck availability before save.
Profile reset, exclusion changes, authorization changes, and disconnect invalidate related pools.

TIDAL writes need recovery semantics beyond disabling a button. A timed-out create may already
have succeeded: mark it uncertain, look up the known destination where supported, and require
review before another create when the outcome cannot be determined. Store completed chunk
progress so a partial append does not replay successful chunks. Verify current endpoint behaviour
and scopes per action; do not assume provider idempotency or attempt automatic rollback.

**Gate:** duplicate submissions and a crash between remote success and local acknowledgement do
not silently duplicate a playlist. Persistence/redaction tests reject provider documents, media
URLs, credentials, and display metadata outside the explicitly bounded current-session contract.

### 5. Mobile composition and playback validation

Build `/now` and minimal Home first, over the reconciled session contract. Reuse the current native
audio engine and Media Session integration; feature-detect supported actions and update metadata,
position, and playback state from the real media element. Media Session provides system controls,
not a guarantee of uninterrupted background playback. [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)

Use small pages and measured image sizes before introducing virtualization. Evaluate
`@tanstack/svelte-virtual` only with a synthetic 1,000-row library fixture and a demonstrated scroll
or render problem. Keep focus stable across recycled rows and provide a paginated fallback.

Record median and p95 play-to-audio times for cold/warm HIGH, LOSSLESS, and HiRes separately. Use
synthetic audio for repeatable Playwright checks and an owner-operated real-device smoke check for
Safari/iOS and Chrome/Android behaviour. Target an immediate pending indication, ordinary queue
actions within 100 ms locally, and live-state propagation within 3 seconds on a healthy connection;
collect a playback baseline before setting a hard upstream-dependent start-time target.

**Gate:** at 320px, 200% zoom, landscape, locale switch, background/foreground transition, and
interrupted network, the main controls stay reachable and the session restores honestly. Never
cache authenticated API responses or audio in a service worker to simulate offline support.

### 6. Evidence-backed explanations and owner feedback

The current engine already emits provenance, but `explain.ts` returns English prose, its discovery
label is inferred from artist affinity, and unknown durations use an assumed length. Tighten the
display contract before adding more score dimensions or promising a duration-targeted set.

- Return structured reasons such as `pinned_artist`, `playlist_affinity`, or `similar_artist`,
  with the supporting identifier, derived contribution, and confidence. Resolve names live and
  use Paraglide to render both locales. Do not persist finished provider-derived sentences.
- Keep algorithm version, profile content revision, and actual available score terms with the
  provisional run. The owner-facing explanation names the meaningful reason; owner diagnostics
  may show the derived breakdown without sending it to operational logs.
- Make unknowns visible: `knownDurationSeconds`, `unknownDurationCount`, and an explicitly marked
  estimate are separate values. Reject or soften exact-duration claims when too much of the pool
  lacks duration; never make an estimated total look measured.
- Define familiarity in terms of the evidence actually collected: profile affinity and current
  explicit saves/playlist membership. Treat it as a preference signal, not a historical claim
  about whether the owner has heard a recording.
- Apply over-representation penalties as tracks are selected, updating artist/album counts for
  each slot. A penalty parameter on a scorer has no effect if the orchestrator never supplies
  updated counts. Check all credited artists when applying exclusions and spacing rules.
- Start feedback with explicit Keep, Less like this, and Exclude. Introduce skip/completion
  inference only when the player can distinguish a deliberate skip from seek, playback failure,
  interruption, or device handoff. Never penalise taste for a network failure.
- Fold feedback into bounded derived deltas once, with an operation ID for deduplication. Undo
  reverses that delta; it must not restore an entire old profile over newer owner changes. Hard
  exclusions and pinned overrides always outrank later inferred updates.

**Gate:** a synthetic matrix covers a cold profile, one-artist pool, conflicting exclusions,
duplicate editions, missing sonic fields, a partial graph, and English/German explanations. Add
specific cases where the first ISRC variant is excluded, a secondary artist is excluded, repeated
feedback arrives, and a duration is unknown. Human review asks whether the reasons match the
actual picks and whether the set remains useful when constraints cannot all be satisfied.

**Package decision:** use the existing pure modules, Paraglide, Valibot, and fast-check. Introduce
no recommender framework, vector database, graph database, or audio-analysis dependency for this
work. The bounded graph and transparent score terms are Halflight's own product logic.

### Adoption order

| Order | Reviewable slice                                                   | Dependencies introduced                                | Evidence before proceeding                                                    |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1     | Input contracts and session conflict reconciliation                | Valibot; fast-check for invariants                     | Racing edits, duplicate requests, stale snapshots, no playback restart        |
| 2     | Playlist dialog, action menu, queue editing                        | Bits UI, svelte-dnd-action, axe Playwright integration | Keyboard/touch editing, focus restoration, locale parity                      |
| 3     | Generator pacing, cancellation, progress, consolidated entry point | p-queue                                                | Budget and abort tests, truthful partial results, deterministic output        |
| 4     | Minimal second-site Home and Now Playing                           | Existing native APIs and shared modules                | Two-host authentication, active-device handoff, actual mobile smoke check     |
| 5     | Profile controls and measured large-list improvements              | Superforms / virtualizer only if their triggers hold   | Reduced duplicated form code or measured rendering improvement                |
| 6     | Durable jobs or optional media experiments                         | pg-boss / S3 SDK / worker tools only after their gates | Restart recovery, retention enforcement, deployment and playback measurements |

For each adopted package, record the chosen version, integration files, removed custom code,
bundle/runtime impact, and validation in the slice's PR or commit description. All code slices run
`pnpm format`, `pnpm check && pnpm lint && pnpm test:unit -- --run`; token/async work also runs
`pnpm lint:types`. Browser acceptance tests use synthetic content and never real account captures.

## Object storage

Object storage is an **optional, gated experiment**, not a prerequisite for the session, taste
engine, or mobile launch. Production has no durable local filesystem, but ordinary owned state
belongs in Postgres and small exports can stream directly from authenticated handlers. Do not add
a bucket merely because a future feature might need one.

The default remains the existing audio proxy. Media retention or processing requires a separately
verified provider-permission decision before implementation; this plan does not establish that
permission. The repository's prohibition on mirroring TIDAL content remains authoritative.

The first approved bucket consumer is a short-lived, owner-requested playlist export. It uses the
server-only S3 adapter with an isolated `HALFLIGHT_EXPORT_BUCKET`, opaque 15-minute object keys,
and authenticated same-origin retrieval/deletion. Direct exports remain the default; audio,
artwork, lyrics, tokens, provider URLs, and the separate worker bucket are excluded.

Owner-uploaded private music is a separate capability: bytes use `HALFLIGHT_PRIVATE_MUSIC_BUCKET`,
while Postgres records only ownership, an opaque key, filename, type, size, and creation time. The
owner can list, download, and delete files through same-origin APIs. Downloads support authenticated
`HEAD` metadata probes and single byte ranges for reliable resumption without exposing bucket URLs.
They use immutable metadata validators so a cache check avoids a bucket read and a stale resumable
request receives the complete current file. The owner can also export an M3U or JSON manifest: a
direct response is the default, while an explicit short-lived copy uses the isolated export bucket.
Manifests contain only same-origin Syn download routes and safe metadata, never object keys. TIDAL
media remains excluded. The collection response reports used, remaining, per-file, and total capacity
from owned metadata so clients can make upload choices without probing object storage.

### Candidate uses and gates

| Use                  | Potential benefit                                                    | What must be proved first                                                                                                          |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| HiRes staging        | Reuse an already prepared segmented track during the current session | Provider permission, capped retention, a measured warm-start benefit, and an unchanged direct fallback                             |
| Next-track prebuffer | Hide next-track resolution latency while the current track plays     | Playback-driven scope limited to the next entry, permission, cancellation on queue change, acceptable bandwidth                    |
| Container remux      | Make a supported codec available in a browser-supported container    | Permission and a real codec/container compatibility matrix; remux cannot fix an unsupported codec                                  |
| Waveform peaks       | Improve visual seeking with a small derived representation           | Permission to process and retain the derivative, usable keyboard seeking, a measured benefit over the existing range control       |
| Loudness analysis    | Fill a measured ReplayGain coverage gap                              | Permission, enough missing upstream data to justify processing, consistent measurements; loudness alone is not perceived energy    |
| Generation snapshots | Reuse derived selection work across workers                          | Store identifiers and derived values only, explicit expiry, live metadata rehydration; prefer bounded memory first                 |
| Export artefacts     | Serve an unusually large owned export                                | A concrete size/runtime problem with direct streaming; export no provider audio, credentials, media URLs, or captured API payloads |

Staging cannot make a **first uncached play** fast merely by moving assembly from memory to a
bucket: the worker must still fetch and assemble the data. Measure cold and warm starts separately.
On a miss or worker failure, use the existing direct path; do not wait for an optional optimisation.
Waveforms and loudness extraction are also conditional even if the final stored output contains
only numbers. Derived output does not itself establish permission to process the source.

### Delivery and retention contract

- If approved, use the server-only S3 SDK through a small `bucket.ts` adapter. The browser keeps
  requesting `/api/tracks/[id]/audio`; the server proxies the object and preserves Range semantics.
  Do not redirect audio to a bucket or provider URL, or put a signed media URL in client state.
- Proposed experiment limits: only current/next track staging, a 2-hour media TTL, a 512 MiB total
  cap, and a 128 MiB object cap. These are engineering ceilings, not statements of permitted
  retention; shorten them if required and reject oversized work rather than silently raising caps.
- Reserve capacity before staging, including concurrent in-flight objects. Enforce expiry on reads
  and run explicit cleanup; bucket lifecycle rules are a backstop, not an exact expiry timer.
- Keep object keys opaque and record only safe identifiers, bytes, expiry, and job state in
  Postgres. Bound and expire derived objects independently; no indefinite per-track derivative store.
- Purge invalidates serving immediately. Disconnect stops new jobs, invalidates authorization,
  cancels in-flight staging, and deletes objects. A worker checks the current connection generation
  before publishing a result so an old job cannot recreate objects after disconnect.
- Report purge failures safely and retry deletion through a bounded job; do not report complete
  deletion while objects remain. Settings shows counts/bytes/oldest age and purge progress only.

### Worker and deployment contract

Use `pg-boss` only once a permitted job must survive a request. Operate a dedicated worker with a
bounded connection pool and concurrency, explicit schema migration ownership, graceful shutdown,
and startup recovery. PM2 can supervise it alongside adapter-node; a Vercel deployment needs a
separately provisioned worker. Do not start polling workers during SvelteKit module import or rely
on an unawaited promise after a serverless response.

```text
queued → processing → ready → expired → purged
    └──── cancelled / failed ────────────┘
```

Jobs carry identifiers, quality, and an authorization generation; they fetch current credentials
server-side when executing. Retries must be idempotent, temporary workspace bounded and disposable,
and failures must leave playback on its direct fallback. If approved remux requires temporary disk,
it is scratch space only; secrets and durable state never depend on it.

```text
src/lib/server/media/           # proposed only after the experiment is approved
├── bucket.ts                  # private put/get/delete and object access
├── staging.ts                 # domain policy, capacity reservation, cancellation
├── peaks.ts                   # optional extraction adapter
└── loudness.ts                # optional measurement adapter
```

Keep format conversion and measurement in proven worker tooling, not handwritten audio codecs or
DSP. Unit-test orchestration with injected stores; integration-test binaries with synthetic audio.
Do not retire the current segmented path until permission, cleanup, Range correctness, resource
bounds, cold/warm performance, and browser playback all pass their gates.

## Capability and scope plan

Verify each against the live API reference before shipping its feature.

| Feature                            | Helper                                          | Scope assumption             | Phase |
| ---------------------------------- | ----------------------------------------------- | ---------------------------- | ----- |
| Account identity                   | `getCurrentUser`                                | `user.read`                  | done  |
| Search                             | `search`                                        | `search.read`                | done  |
| Saved collections                  | `getCollectionPage`, `getFullCollection`        | `collection.read`            | done  |
| Personal mixes / recommendations   | `getMix`, `getRecommendations`                  | `recommendations.read`       | done  |
| Catalogue details                  | `getTrack/Album/Artist`                         | verify per endpoint          | done  |
| Playback (full track)              | device-auth `r_usr` + `playbackinfopostpaywall` | TIDAL Link device grant      | done  |
| Relationship traversal (the graph) | `getArtist/Track/AlbumRelationship`             | verify per relationship      | B–C   |
| Album credits                      | `fetchAlbumCredits`                             | verify                       | C     |
| Save/remove collection item        | `addToCollection`, `removeFromCollection`       | write scope, verify          | D     |
| Create playlist / add items        | `createPlaylist`, `addPlaylistItems`            | playlist write scope, verify | D     |

Do not request a broader scope until its workflow, permission explanation, and tests are ready.

## Error and feedback model

Safe UI-facing error union: `not_authenticated`, `not_connected`, `authorization_expired`,
`playback_not_linked`, `permission_missing`, `rate_limited`, `not_found`, `validation_failed`,
`upstream_unavailable`, `generation_degraded`, `configuration_error`, `unexpected`.

`generation_degraded` is new and deliberate: the engine hit its budget or an upstream edge failed,
produced a smaller or less confident set, and says so rather than silently shipping filler.

Error copy lives in both Paraglide catalogues. Raw upstream payloads, configuration, token details,
stack traces, and database errors never reach the normal UI.

### Feedback conventions

- Skeletons for initial content with a stable layout.
- Inline pending state for single-control mutations.
- Streamed progress for generation, with a cancel action.
- Toast plus updated state for successful background mutations.
- Inline error beside the affected section for local failures.
- Page-level notice only when the whole route cannot function — never for a failure that leaves
  playback intact.
- Dialog confirmation for destructive or hard-to-reverse actions.
- `aria-live` for async results that do not move focus.

## Accessibility requirements

Target WCAG 2.2 AA.

- Everything works by keyboard with a visible, consistent focus indicator, including all transport
  controls, the seek bar, and every knob.
- Sliders expose `role="slider"` with value text ("familiarity, 60 of 100").
- Icon-only actions have accessible names and comfortable touch targets.
- Dialogs trap and restore focus; menus and tabs follow expected patterns.
- Track changes and generation completion are announced without interrupting continuously.
- Status is never colour alone — quality tiers and provenance carry text.
- Artwork has useful alt text when informative, empty when decorative.
- Motion respects `prefers-reduced-motion`; usable at 320px and 200% zoom.
- English and German expansion checked visually.

## Internationalisation

- Every user-facing string in `messages/en.json` and `messages/de-de.json`, added in the same change
  that introduces it.
- Localise titles, notices, validation, empty states, navigation, dates, durations, counts, knob
  labels, and provenance phrasing.
- Preserve TIDAL titles and artist names exactly; never translate catalogue metadata.
- A visible language control in Settings.

## Performance and resilience

- Server-render the shell and first useful content.
- Fetch only what a route needs; parallelise independent requests under a concurrency budget.
- Cursor pagination with small first pages; reserve artwork dimensions.
- **Generation budgets**: a hard upstream request cap, a wall-clock ceiling, and a target of a
  usable set well inside it. Partial graphs degrade confidence rather than failing.
- **Playback budgets**: time-to-first-audio after a play action; segmented HiRes buffers the whole
  track, so it is an opt-in tier with a stated trade-off.
- Timeouts and user-initiated retry; no unbounded automatic retries.
- Preserve partial content when one upstream call fails.

## Privacy, security, and compliance

### Preserve

OAuth with PKCE and state; HttpOnly short-lived transaction cookie; AES-256-GCM token encryption;
refresh with rotation and single-flight coalescing; fixed upstream hosts; no token logging or client
exposure.

### Add before write features

- Same-origin/CSRF validation on every state-changing endpoint.
- Explicit input schemas and request-size limits, including knob bounds.
- A lightweight owner-session throttle on mutation and generation endpoints.
- Confirmation and duplicate-submit prevention for destructive actions.
- Redaction tests for errors, diagnostics, and taste-profile output.
- Security headers appropriate to artwork, TIDAL links, and the embed fallback.
- A production check that development-only diagnostics are disabled.

### TIDAL compliance checkpoint

Before each release that displays new content or changes playback:

1. Review the current Developer Terms, Guidelines, Design Guidelines, and endpoint reference.
2. Verify attribution and link-back treatment.
3. Verify requested scopes match implemented features only.
4. Verify Halflight retains no TIDAL content beyond operating the page — explicitly including the taste
   profile, which must hold only derived weights and identifiers.
5. Verify disconnect deletes Halflight-held personal data and stops further requests.
6. Verify no TIDAL content enters any external model, analytics payload, log, or third-party
   service.

## Testing strategy

### Server unit tests

- Existing crypto, token store, refresh, retry, manifest, and segmented-delivery coverage stays
  mandatory.
- JSON:API relationship resolution and every normaliser, including malformed optional attributes.
- **Taste engine**: pure scoring, sequencing, and explanation functions against hand-written
  profiles and candidate sets — including empty profile, single-artist profile, heavy exclusions,
  and a candidate pool too small to satisfy the request.
- Profile merge, decay, confidence, and owner-override precedence.
- Graph expansion budget enforcement and graceful degradation on a failed edge.
- Safe error translation and redaction, including profile export.

### Component tests

- Player set: transport, seek, quality badge tiers, provenance chips, provisional-queue state.
- Knob panel: bounds, keyboard operation, value announcements.
- Media components with complete, missing-artwork, long-title, and explicit states.
- Pending, success, error, empty, disabled states; English and German.

### Storybook

Stories for every meaningful state; accessibility addon in tests; separate Listening Room and
Halflight Now compositions. A mobile story is never a narrow viewport of a desktop-shell story.

### Playwright end-to-end

- Unauthenticated redirect; connect, callback success, denial, reconnect against mocked boundaries.
- Search → detail → queue → play, asserting audio actually advances.
- Library pagination and remove.
- **Generate → review → swap a track → save**, against a deterministic fixture graph.
- Partial API failure and retry with playback uninterrupted.
- Disconnect and subsequent access prevention.
- Listening Room and Halflight Now sign-in/session continuity, including an ordered simultaneous
  queue edit from both sites.
- Halflight Now navigation, full-screen Now Playing, queue verbs, keyboard-only critical path,
  rotation, safe-area, locale switch, and mobile interruption recovery.

Mock TIDAL at the HTTP boundary with sanitised fixtures. Never record real tokens or personal
library payloads in fixtures, traces, screenshots, or CI output.

### Visual regression

A small stable matrix per site: connected and disconnected Listening Room; its home with content,
partial failure, and skeletons; search, library, generate, playlist dialog, and destructive
confirmation; then Halflight Now home, search, library, mini player, full-screen Now Playing,
queue, lyrics, safe-area, and interrupted-state compositions. Review visual regressions against
the Halflight hierarchy, not generic responsive parity.

## Observability

- Structured server events for route, operation, status category, latency, retry, and correlation
  ID.
- Generation emits stage timings, candidate counts, budget consumption, and final confidence —
  **counts and durations only**, never artist names, track IDs, or profile weights.
- Never log tokens, authorization headers, raw personal payloads, search queries, or playlist names.
- An owner-only health view with the most recent safe failures.
- A lightweight uptime check that never calls personal TIDAL endpoints.

## Delivery roadmap

Effort labels are relative: **S** focused, **M** a vertical slice, **L** several routes or layers.
Ship each phase as a coherent, green change. Launch tracks 0–2 establish the web service; track 3
adds the installed PWA; track 4 is the later native programme. The mobile/PWA/native release gates
define acceptance, while the capability phases below describe the domain work they consume.

### Delivery priorities

| Priority                     | Finish                                                                                                           | Defer until it is accepted                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| P0 — dependable session      | Client conflict reconciliation, explicit queue commands, current audio continuity, truthful persistence failures | A second device writing position and automatic playback takeover                       |
| P1 — complete daily workflow | Accessible queue editing and generation → review → play/save, with bounded requests and localised explanations   | More knobs, expanded relationship coverage, and aesthetic media features               |
| P2 — second-site proof       | Minimal mobile Home/Now, deliberate auth continuity, active-device ownership, actual-device acceptance           | Mobile catalogue breadth and infrastructure for sub-second live updates                |
| P3 — measured improvement    | Better scoring coverage, profile feedback, long-list performance where measured                                  | Optional workers, buckets, waveforms, or remux without their individual evidence gates |

Brand/domain work may proceed alongside P0/P1. The mobile proof depends on session correctness;
it does not depend on the full taste model or optional storage. A failed package compatibility
spike should defer that enhancement or retain the existing implementation, not halt all delivery.

### Launch track 0 — Halflight identity and service spine

Goal: turn the existing product into a coherent Halflight service before multiplying surfaces.

- [ ] Establish `halflight.eu` as the canonical production domain, redirects from the prior public
      hostname, canonical URLs, CSP/origin configuration, and a rollback plan. (M)
- [ ] Apply the Halflight name, wordmark treatment, metadata, Open Graph, sign-in, empty/error,
      settings, and TIDAL-attribution copy across customer-facing surfaces. (M)
- [ ] Enable transactional confirmation email from `noreply@adminmail.bluesix.dev` through the local
      Postfix relay; verify non-open-relay policy, DNS alignment, single-use expiry, redacted logs,
      and delivery/failure states with a real mailbox before enabling sign-in links. (M)
- [ ] Define the default Halflight palette, type scale, luminance ladder, and Apple Music-inspired
      hierarchy as tokens and Storybook reference compositions. (M) — the tokens already existed in
      `layout.css` (palette, `--fs-*` type scale, luminance ladder); what was missing was the
      reference compositions. Storybook now has real coverage for `Button`, `Badge`,
      `SectionHeader`, and `ViewHeader` (the new page-level header primitive that replaced four
      different hand-rolled `<h1>` treatments across nine routes) — the toolchain was fully
      configured since scaffolding but held zero story files until now. Most other components
      still have none, and the palette is a single light theme, not the multi-palette system this
      bullet's wording assumes; whether to build additional themes is an open decision.
- [ ] Audit every current route against the service standard: a clear listening invitation, one
      primary action, queue verbs, calm error recovery, and no operational jargon. (L)
- [ ] Complete client reconciliation over existing session revision/origin handling; add
      operation deduplication and active-device ownership before a second site controls the queue. (M) —
      queue commands now rebase once after a 409 response, preserving local audio while retrying
      append, remove, reorder, clear, and deliberate replacement changes against the returned
      revision. Stable queue-entry IDs and operation deduplication are now implemented end-to-end:
      commands are entry-addressed, `queue_entries_json` persists them (migration `0021` backfills),
      and `playback_operation_result` gives each intent a fingerprinted idempotency key applied
      atomically. The fingerprint no longer depends on `expectedRevision`, so a legitimate retry
      after a lost response — sent with the client's rebased revision — is now replayed from the
      cached result instead of rejected `400 invalid`; and a `400` the client cannot recover by
      retrying (an operation that can never apply, most often a remove/move naming an entryId
      another device already removed) is dropped from the buffer and reported through a new
      `'rejected'` persistence status, rather than retried forever and blocking every command
      queued behind it. All four call sites the player makes to `/api/playback-state` now
      distinguish an ended session (`401`) from a dropped request, including the background poll,
      whose failure path previously changed nothing the UI could observe at all — a session ending
      in one tab surfaced nowhere. What remains: the device lease still wants a fencing epoch, an
      SSR-visible identity, and pause-on-loss; a `500` still reports as the generic `offline`
      message, which is a smaller gap than `401` was — "check your connection" is not actively
      wrong for a server error the way it was for an ended session, just imprecise.
- [ ] Record the domain/cookie/auth design for `halflight.eu` and `m.halflight.eu`; test both hosts
      without widening OAuth or encrypted-TIDAL cookie scope. (M)

Exit: the owner sees one named, composed service with a reliable session contract — not a collection
of routes under an old project name.

### Launch track 1 — Listening Room

Goal: make `halflight.eu` the beautiful, desktop-first place for long listening and considered
curation.

- [ ] Finish shell migration steps 1–3 — grid regions, player as a docked row, header `toolbar`,
      collapsible rail. (L)
- [ ] Recompose Home around resume, one considered set, a small return path, and personal mixes;
      remove generic dashboard density. (M)
- [ ] Make Now Playing, queue, provenance, lyrics, credits, and quality feel like one immersive
      listening destination across the shell and aside. (L)
- [ ] Finish the desktop Apple Music north-star review at real laptop and wide-desktop widths;
      document every intentional departure in the component stories. (M) — `ViewHeader` is one
      concrete departure now fixed and documented in its own stories (nine routes previously
      ranged 24px/600 to 56px/800/uppercase for the same "one hero line" role); the real-width
      visual review across the rest of the shell has not been done.

Exit: Halflight’s desktop experience feels calm, complete, and unmistakably music-first.

### Launch track 2 — Halflight Now

Goal: release `m.halflight.eu` as a real mobile site with the same session, not a responsive
afterthought.

- [ ] Create an independently deployed mobile SvelteKit entry point with its own route tree, shell,
      CSS entry, error boundary, and release pipeline. (L) — deferred: the first slice below keeps
      one repository/deployment per the plan's own allowance, as a `(mobile)` route group.
- [x] Share only display contracts, player/session protocol, authenticated server capabilities,
      i18n, and accessible primitives; do not import `AppShell`, `MobileNav`, desktop tables, or
      desktop page CSS. (M)
- [ ] Build Home, Search, Library, Mini Player, and full-screen Now Playing with queue, lyrics,
      credits, provenance, and all essential queue verbs. (L) — `/now` (full-screen Now Playing:
      artwork, transport, seek) and a minimal `/home` (resume card) exist behind the `(mobile)`
      route group, sharing the `player` singleton, `/api/playback-state`, and design tokens with
      zero desktop-component imports; writes now correctly send `origin: 'halflight-now'` (see
      `player.svelte.ts`'s `origin` field, previously dead code). Queue editing now uses stable
      entry IDs, accessible reorder/remove/clear controls, and visible persistence recovery states.
      Library, lyrics, and credits on mobile are still open. Mobile Search now has a dedicated
      `/search` route, cancellation-safe grouped live results, and track-level play, play-next,
      queue, and radio actions. Mobile Library now presents saved playlists and paginated favorite tracks with
      play, next, queue, retry, connection, and reviewed replacement states; Now Playing includes
      provenance, actual quality, focused lyrics, and contributor credits. Detail sheets and
      physical-device acceptance remain open. Mobile Settings now offers the
      same persisted stream quality, default volume, loudness normalization, and TIDAL connection
      state as the Listening Room without importing its desktop shell.
      Search recovery now includes retry/sign-in/connection actions, 12-second search and
      20-second radio client deadlines, cancellable radio with late-response protection, and
      48-pixel queue controls. Search queries are URL-backed and restore after browser history
      navigation. Browser regression tests cover recovery, radio cancellation, and URL updates;
      physical-device acceptance remains open.
- [ ] Add live session handoff, conflict reconciliation, Media Session integration, and manual
      data/quality preferences with optional network hints. (L)
- [ ] Add mobile-only Playwright, visual, accessibility, rotation, safe-area, keyboard, and
      interrupted-network coverage. (M)
- [ ] Make the desktop-to-mobile handoff respectful: explicit “Open in Halflight Now” where useful,
      deep-link continuity, and no forced cross-site redirect during active playback. (M)

Exit: the owner can leave the desk, open Halflight Now, and continue the exact moment of listening
without thinking about the technology underneath it.

### Launch track 3 — Installed Halflight Now PWA

Depends on M1 mobile website acceptance. Installation uses the same mobile build and routes.

- [ ] Adopt the tested SvelteKit PWA integration and Workbox policy; declare exactly one worker
      registration path and inspect the generated public precache list. (M)
- [ ] Add the stable manifest, owned icons, Settings installation/help flow, and neutral EN/DE
      offline navigation fallback; test actual iOS/Android installation. (M)
- [ ] Implement waiting-worker updates, cross-window readiness, save-before-reload, paused restore,
      previous-client API compatibility, and a worker rollback/recovery procedure. (L)
- [ ] Verify all authenticated data, provider assets, audio/Range, OAuth, and mutations bypass
      persistent worker caches; no offline write queue or fake offline music. (M)
- [ ] Complete P0/P1 release gates: cache inspection, network loss, auth/logout, real-device media
      controls, and v1→v2 update while music plays. (M)

Exit: the owner installs and uses Halflight Now daily, can defer an update safely, and understands
what works offline without losing accepted session state.

### Launch track 4 — Tauri after the PWA

Depends on accepted mobile/PWA behaviour and a named native benefit. Default sequencing is mobile
first; desktop remains a separate optional target until the owner chooses its priority.

- [ ] Prove a bundled frontend, narrow validated IPC, and first-party system-browser sign-in with
      native-only Halflight credentials; preserve the server's TIDAL boundary. (L)
- [ ] Complete N0 separately on Android and iOS: native audio engine, authenticated proxy/Range,
      screen lock, next-track progression while the WebView is suspended, and credential expiry. (L)
- [ ] Share mobile presentation and session contracts; implement native observed playback state,
      interruptions/audio focus, platform media controls, and explicit device takeover. (L)
- [ ] Add verified deep links, owner-only signed distribution, native logout/revocation, API version
      compatibility, and actual-device N1 acceptance. (L)
- [ ] Optional N2: desktop composition, window/quit lifecycle, media keys, and signed updates after
      the mobile/native product demonstrates its value. (L)

Exit: native playback provides a measured improvement over the PWA and remains correct when its
WebView is suspended or recreated. A wrapper that only loads the website does not meet this gate.

### Infrastructure slice — use local Redis deliberately

- [x] Declare `REDIS_CACHE`, add `redis`, and implement a server-only injected adapter with bounded
      connection/command behaviour, safe health reporting, and no disconnected-command replay. (M)
- [ ] Use Redis for bounded derived generation-pool reuse, with profile/auth version invalidation,
      strict payload allowlists, TTL/size checks, and cache-miss fallback. `getTasteProfile` now
      reads/writes through the same bounded cache (5-minute TTL, invalidated on profile
      write/delete) as an early consumer; `generate.ts`/`candidates.ts` pool reuse is still open. (M)
- [ ] Verify instance configuration, then add atomic `rate-limiter-flexible` admission alongside
      the local `p-queue`; reserve playback capacity and test Redis loss/restart. (M)
- [ ] After measuring mobile polling, add revision-only Pub/Sub hints to authenticated SSE clients;
      dropped events recover by reading Postgres. (M)

Exit: repeated generation uses less upstream work and concurrent clients share the same request
budget; a Redis outage neither loses accepted state nor stops already-buffered audio. This slice
does not migrate TIDAL tokens, auth sessions, durable jobs, or the canonical queue into Redis.

### Phase A — Consolidate the session

Goal: make the player unambiguously the centre before building on top of it.

- [ ] Give every listable surface the same queue verbs (play now / next / add / radio). (M)
- [ ] Session provenance: the player can state why the current track is playing. (M)
- [ ] Queue panel editing: reorder, remove, clear, save-as-playlist. (M)
- [ ] Measure cold/warm playback and investigate next-track prebuffer within the existing proxy.
      Apply the Object storage gates before any retained-media experiment. (M)
- [ ] Conditional follow-up: approved bucket/worker staging with resource caps, same-origin Range
      proxying, purge controls, and direct fallback. This does not block the session milestone. (L)
- [ ] Conditional follow-up: remux only where verified codec/container support improves playback. (M)
- [x] Bring the German catalogue level with recent surfaces. (M) — the catalogues were already at
      full key parity; the real gap was user-facing copy written straight into markup, which never
      reached the catalogue and so produced no missing-key count. 39 such strings across six product
      surfaces are now localised, and `src/lib/i18n-coverage.spec.ts` fails the build if more appear.
      `/app/admin` is allowlisted per the diagnostics boundary above.

Exit: playback is uninterruptible by navigation or a failed section; any list can become the queue;
playback start times are measured by quality tier, with honest HiRes trade-offs.

### Phase B — The profile

Goal: Halflight knows the owner, and the owner can see what it knows.

- [x] `signals.ts` live readers with sanitised fixtures. (M)
- [x] `taste_profile` table, `TasteProfileStore`, merge and decay logic. (M)
- [x] On-demand profile rebuild through Settings and the profile API. (M)
- [ ] Verify a post-connection refresh policy that shares the provider budget, preserves owner
      overrides, and never delays playback or the OAuth callback. (M)
- [x] `/app/settings/taste` — plain-language profile, confidence, pin/damp/exclude, export, reset,
      delete. (L)
- [x] Redaction tests over profile output and logs. (S)

Exit: the owner reads their profile and says "yes, that's me" — with no generation yet.

### Phase C — Generation that works

Goal: a real set from a real profile.

- [x] Budgeted `graph.ts` expansion over relationship edges, with degradation. (L)
- [x] `candidates.ts` — initial pool, ID/ISRC dedupe, artist/era filters, injected cooldown IDs. (M)
- [x] Filter eligible variants before dedupe, check all artist exclusions, and wire bounded
      cooldown persistence. (M) — `candidates.ts` checks cooldown, all-artist exclusions, era
      exclusions, minimum length, and explicit-content before ID/ISRC dedup, so an ineligible
      variant can never suppress an eligible remaster or release. `cooldown.ts` is a bounded (500
      tracks, 30-day expiry, capped writes), fail-open Postgres store; both generate pages call
      `/api/generation-cooldown` once a set is genuinely accepted (played or saved), not on every
      preview or regenerate.
- [x] `score.ts` — initial artist/era affinity, novelty, and optional artist-count penalty. (M)
- [x] Apply diversity penalties during selection; add supported request-fit terms and stable
      tie-breaking, with input-order and missing-field tests. (M) — `sequence.ts` applies the
      artist-repeat penalty dynamically during selection (incrementing counts as picks are made,
      which a pre-selection snapshot could not reflect), with stable identifier tie-breaking and a
      test proving the result is independent of input order. The era-window request-fit term lives
      in `score.ts`. Found while verifying this: `score.ts` also accepted an `artistCounts` option
      and computed its own static version of the same penalty, but `generate.ts` never populated it
      — permanently unreachable from the real pipeline, exercised only by its own test. Removed;
      `ARTIST_REPEAT_PENALTY` stays in `score.ts` since `sequence.ts` already imports it from there
      and applies it, correctly, on its own.
- [x] `sequence.ts` — initial affinity opener and artist spacing. Energy arcs and deliberate
      closers remain Phase D work. (M)
- [x] `/app/generate` with a first knob subset (length, familiarity, seeds). (L)
- [x] Actual progress streaming, deadline enforcement, pacing, cancellation, and stale-run
      protection. (M) — `/api/taste/generate` is SSE, aborts upstream graph reads on the request
      signal, and both `/app/generate` and `(mobile)/generate` guard every state write with a
      monotonic run counter so a superseded response can never land. Graph expansion paces
      upstream calls and enforces its own 9s wall-clock ceiling independently of the client.
- [x] Provisional queue in the player; save to Halflight; optional TIDAL push. (M)
- [x] Retire the hardcoded `SOUNDSCAPE_QUERIES` generator. (S)

Exit: a generated hour is better than TIDAL's own mix for the owner, and every pick is explainable.

### Phase D — Nuance

Goal: the difference between "a good playlist" and "uncannily accurate".

- [ ] The full knob set, presets, and profile-derived defaults. (L)
- [x] Structured reasons rendered through Paraglide; honest familiarity, duration, and confidence
      labels in provenance chips and set summaries throughout. (M) — generation now returns
      locale-neutral reason codes with supporting artist/seed identifiers and optional release-year
      evidence. Desktop and Halflight Now render them through Paraglide; set runtime separates
      provider-known seconds from a visibly labelled estimate and names missing coverage. Summary
      copy says “outside your anchors,” never claims untracked listening history.
- [ ] Per-slot swap and fast re-run over a reused pool. (M) — review now supports immediate,
      deterministic per-slot swaps from the bounded candidate pool returned by the active run. The
      pool remains response-local (not a catalogue cache). `#lib/taste/review.ts` owns selection:
      repeated swaps rotate through the whole pool, neighbouring-artist spacing yields only when
      nothing else remains, and duration/discovery values are recomputed with the server's own
      estimate and anchor threshold. Focus stays on the swapped slot and the replacement is
      announced through Paraglide; fast-check covers uniqueness, pool membership, immutability,
      spacing, and summary honesty. A full re-run over a reusable cross-request pool remains open.
- [ ] Exclusions and cooldown as first-class, persisted controls. (M)
- [ ] Contributor and label edges (producer/writer coherence). (M)
- [ ] Conditional waveform experiment using approved peaks and the existing audio element. (M)
- [ ] Conditional loudness/dynamics experiment only after upstream feature coverage demonstrates
      a useful gap and processing permission is established. (L)
- [ ] Bounded generation-pool reuse; persist only IDs and derived values if cross-process reuse
      becomes necessary. (M)
- [ ] `AppAside` as generation provenance and pinned queue — migration steps 4–5. (M) Pinned
      queue and container-aware track tables are shipped; generation provenance and breakpoint
      stories remain.
- [ ] Verified write scopes for save/remove and playlist creation. (M)

Exit: the owner reaches for Halflight instead of TIDAL's own mixes.

### Phase E — Learning

Goal: it gets better without getting weird.

- [ ] Capture keeps/skips/completions and explicit feedback in-session. (M)
- [ ] Fold feedback into the profile as decaying weight deltas; transient events, persisted weights
      only. (L)
- [ ] Show recent profile movement in plain language, with undo. (M)
- [ ] Guardrails: bounded drift per period, no runaway narrowing, a "shake it up" reset. (M)

Exit: three months in, sets are noticeably sharper and the profile is still legible.

### Phase F — Hardening

- [ ] Accessibility audit and high-impact fixes. (M)
- [ ] Full English/German matrix. (M)
- [ ] Production-safe diagnostics and health checks. (M)
- [ ] Dependency, header, secret, log, and gate review. (M)
- [ ] Cold start, token refresh, DB interruption, and upstream degradation tests. (M)
- [ ] README and operational runbook. (S)

Exit: `pnpm check`, `pnpm lint`, `pnpm lint:types`, and the full suite pass; critical journeys pass
against deterministic mocks; the owner can diagnose common failures without opening the database.

## Completed vertical slice: queue conflict safety

Queue persistence is separated from audio playback in the client-safe session coordinator. Writes
are serialized; one 409 rebases deliberate entry-addressed edits onto the accepted server queue;
retries keep stable operation IDs; permanently inapplicable edits are reported and drained without
blocking later commands. Pending edits survive transport and server failures while local playback
continues. Network loss, ended sessions, conflicts, rejected commands, and HTTP 5xx failures have
separate status messages. A server failure now offers an explicit retry in the player, with English
and German copy. Coordinator and player tests cover conflict recovery, retained edits, retry, and
background-sync recovery.

## Completed vertical slice: queue control in Halflight Now

The mobile queue shows the current track and upcoming entries and supports play, reorder, remove,
clear, and save through the existing session commands. Stable queue-entry IDs keep duplicate tracks
distinct. Reorder announcements and controls remain keyboard accessible. Mobile now exposes saving,
offline, conflict, server-error retry, rejected-command, and expired-session states in English and
German; refreshing or retrying queue persistence leaves the current track intact. Browser coverage
checks duplicate removal, reordering, clear, current-track continuity, and the conflict/retry actions.
Existing player tests cover durable queue intent and server conflict recovery.

## Completed vertical slice: mobile interruption and reconnect recovery

When an offline queue command is still pending and a successful background poll reports the same
server revision, the coordinator now resumes that durable command instead of leaving it unsaved.
If a poll briefly sees an older replica revision, the client retains its newer base and uses the
conditional intent write to reconcile safely. The operation ID is reused, so retry remains
idempotent. A 401 that later recovers follows the same path. Player and coordinator tests verify the
current track, position, and playing state survive both network and authentication recovery, with no
playback claim; prior tests cover explicit retry after a transient service failure. The default suite
keeps the high-value client and server tests together and runs Storybook checks separately.

## Recommended next vertical slice

**Halflight Now cold-open and resume.** Finish the core mobile listening path before adding more
discovery surfaces: restore the accepted session without surprise playback and make deliberate
resume work from the mobile Home and Now screens.

1. Verify server restore wins over the optimistic local queue cache while pending queue commands are
   rebased and kept durable.
2. Make the resume action show a clear loading/ready/failure state and require one deliberate tap to
   start audio; page load and restored playback state must not invoke autoplay.
3. Cover the journey from authenticated mobile Home to Now Playing and audible-start intent at a
   narrow viewport, including an unavailable-session recovery path.

**Accepted when:** a cold open restores the same current track, position, queue, and history without
starting audio; one explicit resume action starts playback and navigation preserves the session.

## Success measures

One user, so measure task quality rather than growth:

- Cold open to audio in one deliberate action.
- A generated hour that the owner keeps at least half of, without editing.
- The owner can explain, from the UI alone, why any track is playing.
- Adjusting one knob produces a noticeably different — and still coherent — set.
- The profile view reads as recognisably the owner's taste.
- Playback never stops because of a UI or API failure.
- The owner can move from Listening Room to Halflight Now (and back) mid-session with the current
  track, position, queue, provenance, and quality state intact.
- Halflight Now reaches sound, essential queue control, and Now Playing in one hand at 320px; the
  Listening Room remains composed and productive at laptop and wide-desktop widths.
- The product looks and sounds like Halflight everywhere: calm Apple Music-level hierarchy, original
  dark half-light character, correct TIDAL clarity, and no remnant of “Syn” in customer-facing copy.
- No token, raw JSON, stack trace, or unexplained API status in normal use.
- Green checks, lint, type-aware lint, unit tests, and critical e2e per release.

## Definition of done for every slice

- Happy path, loading, empty, partial-failure, unauthorised, and disconnected states handled.
- Playback survives every failure mode the slice introduces.
- Server inputs validated; errors redacted.
- No secret or token material crosses the server boundary or enters logs/tests.
- No taste-profile content in logs, analytics, or third-party calls.
- Strings in English and German.
- Keyboard, focus, screen-reader naming, contrast, reduced motion, and zoom checked. For a change
  touching a site shell, verify the Listening Room at its supported desktop widths and Halflight Now
  independently at mobile width, landscape, rotation, safe areas, and browser-chrome constraints.
- A customer-facing change uses the Halflight name, voice, canonical metadata, and applicable TIDAL
  attribution; technical `syn_*` identifiers change only in a separately approved migration.
- Unit/component/e2e coverage matched to risk.
- Storybook covers reusable visual states.
- TIDAL scopes, terms, attribution, and retention implications reviewed.
- `pnpm format` run; `pnpm check && pnpm lint && pnpm test:unit -- --run` passes, or the exception
  is reported plainly.

## Open decisions and feasibility spikes

Each spike ends with a recorded finding, a small reproducible check, and a proceed/defer decision.
Historical account observations from 2026-09-04 are evidence for the original sample, not an API
stability guarantee or a reason to probe the live account during documentation work.

| Question                                      | Existing evidence / next check                                                                                                                   | Blocks                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Relationship coverage                         | Similar artists and artist tracks were observed; validate normalised relationships, pagination, and regional gaps per feature                    | Additional expansion edges, not the existing engine         |
| Genre/mood taxonomy                           | The recorded sample found none; keep genre out of schemas and UI until an explicit reliable source is verified                                   | No current milestone                                        |
| Popularity, ISRC, BPM/key/ReplayGain coverage | Fields were observed; measure missingness and scale differences in the intended shortlist workflow                                               | Depth and sonic controls, not initial artist/era generation |
| Cooldown and feedback retention               | Use bounded ID/expiry state and weight deltas; define deletion and undo before collection                                                        | Learning loop                                               |
| Write capability and uncertain outcomes       | Verify exact scopes, limits, ordering, conflict tokens, and reconciliation per named action                                                      | Each new TIDAL mutation                                     |
| Two-host authentication                       | Prove the chosen host-only sign-in on both sites and in installed PWA contexts; preserve narrowly scoped TIDAL cookies and exact trusted origins | Mobile release                                              |
| Active-device ownership                       | Test takeover, stale position writes, sleep/wake, and disconnected buffered audio                                                                | Honest cross-site handoff                                   |
| Provider request coordination                 | Confirm both sites use one scheduling authority, or prove cross-process admission control                                                        | Concurrent multi-deployment generation                      |
| Durable job runtime                           | Prove worker restart, Neon connection budget, migrations, and job expiry for the selected adapter                                                | First durable background job                                |
| Media permission and usefulness               | Record an explicit permission finding and measured benefit before staging, remux, peaks, or loudness processing; otherwise defer them            | Optional media experiments only                             |
| Component compatibility                       | Verify exact Bits UI / drag action / optional virtualizer releases against current runes, SSR, async mode, and browser tests                     | Their individual adoption slices                            |
| Diagnostics exposure                          | Keep developer tools gated; settle whether safe read-only owner diagnostics ship in production                                                   | Diagnostics release only                                    |

## Risks and mitigations

| Risk                                           | Mitigation                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The graph is too thin to generate well         | Prove it in the next vertical slice before building knobs; fall back to seeded search                                                            |
| Generation is slow                             | Hard request and wall-clock budgets, reused pools on re-run, streamed progress                                                                   |
| The engine narrows onto a rut                  | Novelty term, artist over-representation penalty, cooldown, bounded drift, "shake it up"                                                         |
| The profile feels wrong and opaque             | Plain-language profile view, owner overrides that outrank inference, one-click reset                                                             |
| Taste data becomes a de-facto catalogue mirror | Derived weights and identifiers only; compliance checkpoint item 4; redaction tests                                                              |
| The bucket drifts into an archive              | Size cap with LRU eviction, short TTL, playback-driven staging only, no bulk action, visible size + purge in Settings, full delete on disconnect |
| Bucket cost or egress surprise                 | Hard cap, staging only what is playing or next, derived artefacts (KB) outlive audio (MB)                                                        |
| API beta or endpoint changes                   | Thin wrapper, normalise at the boundary, verify reference docs per feature                                                                       |
| Insufficient scopes                            | Capability checks and least-privilege reconnect before implementation                                                                            |
| Playback regressions                           | Global-`fetch` CDN rule, segmented-delivery tests, e2e that asserts audio advances                                                               |
| UI rebuild becomes too broad                   | Vertical slices; shell migration in six independent PRs                                                                                          |
| German drifts behind English                   | Both catalogues required in each slice's definition of done                                                                                      |

## Source checkpoints

Recheck during delivery:

- [TIDAL authorization](https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization)
- [TIDAL API and SDK quick start](https://developer.tidal.com/documentation/api-sdk/api-sdk-quick-start)
- [TIDAL developer guidelines](https://developer.tidal.com/documentation/guidelines/guidelines-developer-guidelines)
- [TIDAL design guidelines](https://developer.tidal.com/documentation/guidelines/guidelines-design-guidelines)
- [TIDAL developer terms](https://developer.tidal.com/documentation/guidelines/guidelines-developer-terms)
- [TIDAL Embeds overview](https://developer.tidal.com/documentation/embeds/embeds-overview)
- [TIDAL API and SDK reference entry point](https://developer.tidal.com/reference)
