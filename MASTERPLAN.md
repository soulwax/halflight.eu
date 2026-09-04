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
the full **Listening Room** on desktop and the focused **Halflight Now** mobile site.

Last reviewed: 2026-09-04.

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
   or audio. Object storage is working space for the current session under the rules in **Object
   storage**: capped, short-TTL, playback-driven, purgeable — a cache, never a collection.
7. **The taste engine is deterministic and explainable.** Given the same profile, knobs, and
   upstream responses it produces the same set, and every track can state why it was chosen. No
   opaque scoring the owner cannot inspect.
8. **Nothing is written to TIDAL without review.** A generated set is provisional until the owner
   explicitly saves it.
9. **Keep an escape hatch for development.** The raw API console stays behind a development-only or
   explicit advanced gate, read-only by default.
10. **Build accessible components before visual polish.** Keyboard access, focus, semantics, reduced
    motion, and contrast are acceptance criteria, not cleanup.
11. **Design from the Apple Music north star.** Calm hierarchy, album and artist primacy, and an
    immersive Now Playing destination govern every product decision; Halflight remains visually and
    behaviourally original.
12. **Mobile is a separate site, not a breakpoint.** It shares identity, playback state, and server
    capabilities with the Listening Room, but has its own routes, navigation, layouts, interaction
    contracts, and release acceptance tests.

## Current state

Much of the original plan's early phases has shipped. This is where the effort now sits.

| Area                | What exists                                                                                                     | Main gap                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Service experience  | Strong player foundation and all major browse routes                                                            | No single product model yet; home and routes still read like separate pages  |
| Playback            | Full-track streaming (BTS single-file + segmented DASH), Range/seek, quality ladder, ReplayGain, embed fallback | No gapless/crossfade; no pre-buffering of the next queue item                |
| Player UI           | Decomposed component set, docked shell region, queue/lyrics/source panels, floating mode, self-check telemetry  | Queue editing is basic; no "why is this playing?" provenance                 |
| Session state       | Resumable queue/history/position persisted to `playback_state`                                                  | No session provenance; no per-track feedback capture                         |
| Auth / TIDAL OAuth  | Better Auth, PKCE + state, dual-token model, encrypted persistence, rotation, single-flight refresh             | Stable                                                                       |
| API client          | Authenticated fetch, pre-expiry refresh, 401 retry, typed helpers, JSON:API normalisers, `loadTidalPage`        | Relationship traversal helpers exist but are barely used                     |
| Product surfaces    | Shell, home, search, library, mixes, artist/album/track/playlist detail, settings                               | Surfaces do not yet consistently offer the same queue verbs                  |
| Playlist generation | `/api/generate-playlist` — a hardcoded vibe × era → search-query map, texture modifier, energy-arc ordering     | **Knows nothing about the owner.** This is the centre of this plan           |
| Taste model         | None                                                                                                            | Everything below in _The taste engine_                                       |
| Object storage      | None wired; `syn-worker` is named in config but not implemented                                                 | HiRes cold start, prebuffer, waveform, and measured loudness all wait on it  |
| Design system       | Eight dark palettes, semantic tokens, extracted `player.css`, shared badges/formatters                          | Apple Music-level hierarchy and two deliberate site compositions are missing |
| i18n                | Paraglide `en` + `de-DE`                                                                                        | Newer surfaces added strings ahead of the German catalogue                   |
| Testing             | Strong server coverage (tokens, crypto, manifests, segmented delivery, stores); leaf component tests            | Little end-to-end; no taste-engine fixtures yet                              |

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

This is the centrepiece of the plan and the largest new body of work.

Today's generator maps a `vibe × era` pair to a hardcoded list of search strings. It produces
plausible music. It cannot produce **your** music, because it has never looked at you.

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

The dimensions below are the ones the API actually supports; see _What the API does and does not
give us_ for why genre is absent and where the sonic dimensions come from.

```ts
interface TasteProfile {
	// Weighted affinity, all normalised 0–1, each with a confidence.
	artists: Map<ArtistId, Weight>; // playlist membership + follows
	neighbours: Map<ArtistId, Weight>; // via similarArtists from the anchors
	eras: Map<Decade, Weight>; // from album releaseDate
	contributors: Map<PersonId, Weight>; // producers/writers from v1 credits (Phase D)
	labels: Map<LabelName, Weight>; // best-effort, parsed from `copyright` (Phase D)

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

Verified against the live v2 and v1 endpoints, 2026-09-04. This is the constraint the engine is
built inside.

**Not available — genre.** Neither v2 (`artists`, `albums`, `tracks`) nor the v1 track/album
endpoints expose a genre or mood taxonomy. `mediaTags` is audio quality (`LOSSLESS`,
`HIRES_LOSSLESS`), not genre. **The planned `genres` dimension is dropped.** Nothing in the engine
may depend on a genre string.

**Available and better than assumed — real musical attributes.** The v1 track endpoint returns
`bpm`, `key`, `keyScale`, `replayGain`, `peak`, `popularity`, `isrc`, `explicit`, `duration`, and a
`mixes.TRACK_MIX` id. That is actual tempo, actual harmonic key, and actual loudness — so the
engine does **not** need to approximate energy from popularity and genre, and does not need to
measure loudness itself. Cost: one v1 call per track, so it is a scoring-stage enrichment for
shortlisted candidates, not something to run across the whole pool.

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

**Candidate pool.** Union of the expansion, deduplicated by ISRC where available (so the same
recording does not appear as single, album, and remaster). Then filter:

- Drop anything in the owner's exclusions.
- Drop anything under a **cooldown** — appeared in a generated set in the last _N_ days — so
  consecutive generations do not repeat.
- Drop unavailable-in-region and non-streamable items early.
- Apply the request's own filters (era window, explicit tolerance, instrumental bias, minimum
  length).

**Scoring.** Each surviving candidate gets a transparent score:

```text
score = affinity × w_fam
      + novelty  × w_disc
      + fit      × w_req      − penalty(fatigue, over-representation)
```

- **Affinity** — closeness to the profile centre across artist, neighbour, genre, era, label, and
  contributor dimensions.
- **Novelty** — distance from what the owner already knows, _directional_: unfamiliar but adjacent
  scores high; unfamiliar and unrelated scores low. This is what stops "discovery" from becoming
  "random".
- **Fit** — how well the track matches this specific request's knobs.
- **Penalties** — artist over-representation, tracks structurally similar to ones already picked,
  recently played fatigue.

**Sequencing.** Selection is not the end; order is most of the felt quality.

- **Energy arc** shapes the run: flat, gentle build, wave, wind-down, or peak-and-release. Energy is
  approximated from available signals (popularity, track length, genre, era, editorial-mix context)
  — honestly labelled as an approximation, not a fake audio-feature vector.
- **Opener and closer** are chosen deliberately: an opener with high affinity (earn trust first), a
  closer that resolves rather than cuts off.
- **Spacing rules**: no two tracks by the same artist adjacent unless cohesion is maxed; the same
  album at most twice; genre drift rate bounded by the cohesion knob.
- **Discovery placement**: unfamiliar tracks are seeded after the opener and away from each other,
  so a set never front-loads three unknowns.

### The knobs

Nuance lives here. Defaults come from the profile; every knob is optional.

| Knob                        | Range / values                                                                       | Effect                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **Length**                  | track count or target duration (e.g. "about 90 minutes")                             | Set size; duration targeting beats count                                                       |
| **Familiarity ↔ Discovery** | 0–100                                                                                | Share of tracks already in the profile                                                         |
| **Depth**                   | hits ↔ deep cuts                                                                     | Popularity band of picks                                                                       |
| **Era**                     | anchor + spread ("centred 2016, ±8y") or unconstrained                               | Release-date window and its softness                                                           |
| **Energy arc**              | flat / build / wave / wind-down / peak-and-release                                   | Sequencing shape                                                                               |
| **Cohesion ↔ Variety**      | 0–100                                                                                | Genre drift rate, artist repeat spacing                                                        |
| **Context**                 | focus · driving · workout · dinner · late night · background · melancholy · euphoric | A small curated vocabulary mapped to genre, length, and popularity constraints — not free text |
| **Seeds**                   | whole profile · an artist · an album · a playlist · up to 5 tracks · "lately"        | What the expansion starts from                                                                 |
| **Explicit**                | allow / avoid / exclude                                                              | Filter                                                                                         |
| **Instrumental bias**       | 0–100                                                                                | Prefers instrumental where detectable                                                          |
| **Exclusions**              | artists, genres, eras                                                                | Hard filters, persisted to the profile                                                         |
| **Cooldown**                | days                                                                                 | Repeat suppression across generations                                                          |

Presets are just saved knob sets — "Sunday morning", "gym", "deep dive on one artist" — and the
owner can name and pin their own.

### Explainability

Every track carries a short provenance chip, and the set carries a summary:

```text
SET · 28 tracks · 1h 52m · gentle build · 38% new to you · confidence: good

  1  Track A          you saved this artist's last two albums
  2  Track B          similar to [loved artist] · 2017 · deep cut
  3  Track C          same producer as [loved album]
  4  Track D          appears on 3 of your own playlists
  5  Track E          from your Discovery Mix · down-weighted
```

If the engine cannot explain a pick, it does not make it.

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
- It contains derived weights, TIDAL identifiers, genre/label strings, and knob defaults. No
  catalogue text beyond tags, no artwork, no audio, no lyrics.
- Inputs are re-read live from TIDAL; nothing upstream is mirrored.
- No profile content is logged, sent to analytics, or transmitted to any third party.
- View, export, reset, and delete are first-class actions in Settings, and delete is offered on
  disconnect.

---

## Design direction

Halflight should be visually distinct from TIDAL while respecting TIDAL's content and attribution
rules. Apple Music’s calm, album-forward hierarchy is the north star; Halflight translates it into
a dark, high-contrast half-light world: inked neutral surfaces, softened illumination, restrained
accent, generous artwork, and strong, spacious typography.

### Design tokens

Semantic custom properties in `src/routes/layout.css`, consumed through Tailwind: canvas, surface,
elevated surface, subtle border; primary/secondary/muted text; action accent and contrast; success,
warning, danger, information; focus ring, selected, skeleton, overlay; spacing, radii, shadows,
content widths, motion durations.

Eight named dark palettes exist and are persisted per owner. The default Halflight palette must be
the reference composition; alternative palettes are personal atmosphere, not competing themes.
Quality badges colour by fidelity tier (grey lossy, cyan lossless, gold HiRes) via `qualityTier()`.

Typography and hierarchy rules:

- The work currently playing gets the largest, most breathable type and most generous artwork.
  Artist and release context are intimate secondary information; diagnostic detail never competes.
- Home sections are few, named like listening invitations, and terminate. No infinite shelves, no
  tiny repeated cards, and no engagement-oriented “because you played” clutter.
- Use a restrained luminance ladder — canvas, surface, elevated surface, then one warm focal light —
  so the eye lands on music before controls. Gradients imply changing light, never decoration.
- Motion is spatial and functional: artwork settles, panels reveal context, the mini player grows
  into Now Playing. It never bounces, loops, or asks for attention while music is playing.

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

- **Rail** — primary navigation, account, theme. Persisted collapsed state on wide screens; it
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
- **Device-aware quality is explicit.** Mobile defaults and Wi-Fi/cellular behaviour are owner-set;
  the UI says what actually plays. It does not promise offline playback or background capabilities
  that the browser cannot provide.
- **It is a website, not a disguised native app.** Installability, media-session integration, and
  safe-area polish are welcome where reliable, but every critical journey works in the browser
  without an install prompt or a fragile PWA-only dependency.

### Halflight Now acceptance bar

- From a cold mobile open to audible music in one deliberate action.
- One-thumb access to pause, skip, seek, queue, play next, remove, and save.
- At 320px width, 200% zoom, landscape, interrupted network, and device rotation, no control is
  obscured by the browser chrome, safe area, mini player, or tab bar.
- Mobile and desktop can take turns controlling a live session without a reload, surprise playback
  restart, or ambiguous queue state.
- Its home and Now Playing screen feel composed in their own right; no CSS rule imports the desktop
  grid, rail, table, or aside.

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
              Postgres + short-lived bucket working state
```

- **Share domain logic, never whole layouts.** Display models, player/session protocol, server
  actions, i18n messages, tokens, and accessible primitives may be shared. Shells, routes,
  navigation, responsive CSS, page compositions, and interaction state are site-owned.
- **Keep trust boundaries intact.** Both hosts authenticate on the server; neither receives TIDAL
  tokens, stream URLs, or bucket credentials. OAuth transaction and encrypted TIDAL cookies remain
  narrow, HttpOnly, Secure, SameSite=Strict, and explicitly expired. Establish session continuity
  across the two hosts deliberately, with tests, rather than widening token-cookie scope by habit.
- **Make session changes ordered.** Add a server-assigned session revision plus action origin to
  `playback_state`. Updates use optimistic concurrency: accept the next revision, return the latest
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

A new server module, following the established `*Store` + injected-dependency pattern so every
stage is unit-testable with no DB and no network.

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
- `graph.ts` and `signals.ts` take an injected TIDAL client and are tested against recorded,
  sanitised fixtures.
- `generate.ts` enforces the request budget and wall-clock ceiling and always returns a usable set,
  degrading confidence rather than failing.
- Generation runs as a server action with streamed progress; it is cancellable.

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
- Halflight-owned preferences: theme, streaming quality, volume, normalisation, layout booleans.
- Bounded workflow state: the resumable queue, history, and position.
- **The derived taste profile** — weights, identifiers, knob defaults, exclusions, timestamps.

Do not persist catalogue, artwork, playlist, or listening-history mirrors. Object storage is the one
sanctioned exception, under the rules in **Object storage** below.

## Object storage

Prod has no persistent local filesystem, so anything larger than a database row needs a bucket. The
bucket is not a library — it is **working space for the session**. Every object either makes the
next few minutes of listening better, or it is derived data small enough to keep.

A separate `syn-worker` service (see the `SYN_WORKER_*` variables) owns the long-running jobs; the
SvelteKit server never blocks a request on a bucket write.

### What it is for

Ordered by value to the player.

**1. HiRes staging — the reason the bucket exists.**
`HI_RES_LOSSLESS` arrives as a DASH init segment plus dozens of fragments. Today `segmented.ts`
fetches them all into memory, concatenates, and only then serves the first byte — so HiRes has a
multi-second cold start and a 128 MB in-process cache that dies with the function. Instead: the
worker assembles the track once into the bucket, and `/api/tracks/[id]/audio` redirects to (or
proxies) a short-lived signed URL with native Range support. Time-to-first-audio drops to a normal
CDN fetch, the memory cache disappears, and seeking becomes real instead of buffer-backed.

**2. Next-track prebuffer.**
While the current track plays, stage the next queue item. Transitions stop being a cold resolve →
manifest → CDN round trip. This is what makes a generated 28-track set feel like a record rather
than a series of requests.

**3. Container normalisation.**
Some tiers arrive in a container the browser will not decode natively (FLAC-in-fMP4 is the live
example), and today that falls back to the TIDAL embed — losing quality telemetry, the queue, and
the seek bar. The worker can remux (stream copy, no re-encode) into a container the `<audio>`
element accepts, keeping playback inside Halflight. Remux only; never transcode, never re-encode.

**4. Waveform peaks.**
A peaks array computed once while a track is staged, stored as a few KB of JSON. The seek bar
becomes a real waveform instead of a plain range input — the single highest-visibility upgrade the
player can get for the least data. Peaks are derived numbers, not content, so they outlive the audio
object.

**5. Measured loudness and dynamics.**
While the audio is in hand, measure integrated LUFS, true peak, and dynamic range. Two payoffs:
normalisation stops depending on whether TIDAL returned ReplayGain, and **the taste engine gets a
real energy signal** for tracks the owner has actually played — replacing part of the honest
"approximated from popularity and genre" caveat in _Stage 4_ with measurement. Store the numbers,
discard the audio.

**6. Generation pool snapshots.**
A generation run produces an expansion graph and a scored candidate pool. Persisting that as one
compressed JSON object for a short TTL makes "nudge a knob and re-run" near-instant instead of
re-walking the graph and re-spending the upstream budget. Keyed by profile version + seed set, so a
stale profile invalidates it.

**7. Export artefacts.**
M3U exports, taste-profile JSON exports, and owner-only diagnostic captures, served through
short-lived signed URLs rather than streamed through the app server.

### Guardrails

These are the conditions under which the above is acceptable at all.

- **Media objects are a cache, not a collection.** Short TTL (hours, not weeks), a hard total size
  cap, and least-recently-used eviction. Reaching the cap evicts; it never grows the bucket.
- **Staging is playback-driven.** The worker stages what is playing or next in the queue. There is
  no "cache my whole library" action, no crawler, no background sweep over saved albums.
- **Derived artefacts are the durable ones.** Peaks, loudness, and dynamics are kilobytes of
  numbers and may persist with the profile. Audio objects are the disposable ones.
- **Signed, short-lived, private.** No public objects, no guessable keys, no URL that outlives its
  purpose. Bucket credentials stay server-side like every other secret.
- **Owner-visible and purgeable.** Settings shows what the bucket currently holds — object count,
  total size, oldest entry — with one action to purge it. Disconnect purges everything.
- **Deletion is complete.** Disconnecting removes media objects, derived artefacts, generation
  snapshots, and exports, not just the database rows.
- **Compliance gate.** Before enabling media staging in production, confirm against the current
  TIDAL Developer Terms that a short-lived, private, owner-scoped playback cache is permitted, and
  record the finding. If it is not, uses 4–7 still stand on their own — peaks, loudness, snapshots,
  and exports involve no stored audio.

### Object lifecycle

```text
  queued ──► staging ──► ready ──► (played) ──► expired ──► purged
     │          │           │                                  ▲
     │          └── failed ─┴──────────────────────────────────┘
     └── cancelled (track skipped before staging finished)
```

- The player never waits on `staging`. If a track is not `ready`, it falls back to the existing
  direct proxy — staging is an optimisation, never a dependency.
- `failed` is silent to the owner unless it happens repeatedly; the direct path already works.
- Skipping a track cancels its staging job and any prebuffer that is no longer next.

### Where it lives

```text
src/lib/server/media/
├── bucket.ts        signed URL issue, put/get/delete, size accounting
├── staging.ts       job state machine, LRU eviction, cap enforcement
├── peaks.ts         waveform extraction (pure over a byte source)
└── loudness.ts      LUFS / true-peak / dynamic-range measurement
```

`peaks.ts` and `loudness.ts` are pure over an input buffer and unit-testable with synthetic audio.
`bucket.ts` follows the established `*Store` pattern so tests inject an in-memory bucket.

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
Ship each phase as a coherent, green change. The three launch tracks below establish Halflight as a
service; they are the priority framing for every existing capability phase that follows.

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
      hierarchy as tokens and Storybook reference compositions. (M)
- [ ] Audit every current route against the service standard: a clear listening invitation, one
      primary action, queue verbs, calm error recovery, and no operational jargon. (L)
- [ ] Add canonical session revision/origin handling and an explicit session-conflict contract
      before a second site can control the queue. (M)
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
      document every intentional departure in the component stories. (M)

Exit: Halflight’s desktop experience feels calm, complete, and unmistakably music-first.

### Launch track 2 — Halflight Now

Goal: release `m.halflight.eu` as a real mobile site with the same session, not a responsive
afterthought.

- [ ] Create an independently deployed mobile SvelteKit entry point with its own route tree, shell,
      CSS entry, error boundary, and release pipeline. (L)
- [ ] Share only display contracts, player/session protocol, authenticated server capabilities,
      i18n, and accessible primitives; do not import `AppShell`, `MobileNav`, desktop tables, or
      desktop page CSS. (M)
- [ ] Build Home, Search, Library, Mini Player, and full-screen Now Playing with queue, lyrics,
      credits, provenance, and all essential queue verbs. (L)
- [ ] Add live session handoff, conflict reconciliation, Media Session integration, and explicit
      Wi-Fi/cellular quality preferences. (L)
- [ ] Add mobile-only Playwright, visual, accessibility, rotation, safe-area, keyboard, and
      interrupted-network coverage. (M)
- [ ] Make the desktop-to-mobile handoff respectful: explicit “Open in Halflight Now” where useful,
      deep-link continuity, and no forced cross-site redirect during active playback. (M)

Exit: the owner can leave the desk, open Halflight Now, and continue the exact moment of listening
without thinking about the technology underneath it.

### Phase A — Consolidate the session

Goal: make the player unambiguously the centre before building on top of it.

- [ ] Give every listable surface the same queue verbs (play now / next / add / radio). (M)
- [ ] Session provenance: the player can state why the current track is playing. (M)
- [ ] Queue panel editing: reorder, remove, clear, save-as-playlist. (M)
- [ ] Stand up the bucket: `bucket.ts`, `staging.ts`, the `syn-worker` job runner, size cap and LRU
      eviction, plus the Settings panel that shows and purges it. (L)
- [ ] HiRes staging — assemble segmented tracks in the worker and serve a signed Range-capable URL;
      retire the in-memory segment cache. (M)
- [ ] Pre-buffer the next queue item; measure time-to-first-audio before and after. (M)
- [ ] Container normalisation (remux only) so unplayable tiers stop falling back to the embed. (M)
- [ ] Bring the German catalogue level with recent surfaces. (M)

Exit: playback is uninterruptible by navigation or a failed section; any list can become the queue;
HiRes starts in about the time a normal track does.

### Phase B — The profile

Goal: Halflight knows the owner, and the owner can see what it knows.

- [x] `signals.ts` live readers with sanitised fixtures. (M)
- [x] `taste_profile` table, `TasteProfileStore`, merge and decay logic. (M)
- [x] Profile build job triggered on demand and after connection. (M)
- [x] `/app/settings/taste` — plain-language profile, confidence, pin/damp/exclude, export, reset,
      delete. (L)
- [x] Redaction tests over profile output and logs. (S)

Exit: the owner reads their profile and says "yes, that's me" — with no generation yet.

### Phase C — Generation that works

Goal: a real set from a real profile.

- [x] Budgeted `graph.ts` expansion over relationship edges, with degradation. (L)
- [x] `candidates.ts` — pool, ISRC dedupe, filters, cooldown. (M)
- [x] `score.ts` — affinity / novelty / fit / penalties, fully unit-tested. (L)
- [x] `sequence.ts` — energy arcs, spacing, opener/closer. (M)
- [x] `/app/generate` with a first knob subset (length, familiarity, seeds) and streamed progress. (L)
- [x] Provisional queue in the player; save to Halflight; optional TIDAL push. (M)
- [ ] Retire the hardcoded `SOUNDSCAPE_QUERIES` generator. (S)

Exit: a generated hour is better than TIDAL's own mix for the owner, and every pick is explainable.

### Phase D — Nuance

Goal: the difference between "a good playlist" and "uncannily accurate".

- [ ] The full knob set, presets, and profile-derived defaults. (L)
- [ ] `explain.ts` provenance chips and set summary throughout. (M)
- [ ] Per-slot swap and fast re-run over a reused pool. (M)
- [ ] Exclusions and cooldown as first-class, persisted controls. (M)
- [ ] Contributor and label edges (producer/writer coherence). (M)
- [ ] Waveform peaks captured during staging; real waveform seek bar. (M)
- [ ] Measured loudness/dynamics during staging, feeding both normalisation and the engine's energy
      term — replacing part of the popularity-and-genre approximation with measurement. (L)
- [ ] Generation pool snapshots in the bucket so knob re-runs skip the graph walk. (M)
- [ ] `AppAside` as generation provenance and pinned queue — migration steps 4–5. (M)
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

## Recommended next vertical slice

**One Halflight moment across two sites.** Prove the new service promise before a full mobile
catalogue build:

1. Establish `halflight.eu` and the Halflight identity on the existing Home and player surfaces.
2. Add server-issued `playback_state` revision and action origin, with unit tests for conflict and
   reconciliation.
3. Build `m.halflight.eu/now` plus a minimal Home: resume or start one existing generated set.
4. Open the same session on both sites; play, seek, queue next, and remove an item from either one.
5. Assert that the other site receives the new state without restarting audio, leaking a secret, or
   losing provenance.

If this feels like one private streaming service in two perfect contexts, the rest of Halflight Now
is worth building. If it does not, fix the session and the composition before adding route breadth.

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

1. **Relationship coverage** — which artist/track/album relationships are public, stable, and
   paginated? The graph's shape depends entirely on this. _Blocks Phase C._
2. **Genre and mood tags** — does the v2 catalogue expose usable genre tags, or must genre be
   inferred from mix membership and editorial context? _Blocks profile genre weights._
3. **Popularity signal** — is there a stable popularity or play-count field to drive the
   hits ↔ deep-cuts knob, or must it be approximated?
4. **ISRC availability** — is ISRC present often enough to dedupe recordings reliably?
5. **Listening history** — does TIDAL expose recently-played, or must session history come solely
   from Halflight's own `playback_state`?
6. **Credits at scale** — is `fetchAlbumCredits` cheap enough to build contributor weights, or is it
   a Phase D luxury?
7. **Energy approximation** — which available fields correlate usefully with perceived energy, and
   is the correlation strong enough to be worth claiming?
8. **Write scopes** — exact scope names and approval needed for collection and playlist mutations.
9. **Diagnostics** — development-only, or owner-accessible in production read-only?
10. **Bucket permissibility** — do the current TIDAL Developer Terms allow a short-lived, private,
    owner-scoped playback cache? _Blocks bucket uses 1–3; uses 4–7 store no audio and stand
    regardless._ Record the finding either way.
11. **Bucket provider and shape** — S3-compatible, Vercel Blob, or R2? What TTL, total cap, and
    per-object cap? Where does `syn-worker` run for each deployment target (Vercel vs PM2)?
12. **Remux dependency** — is shipping `ffmpeg` into the worker acceptable on both deployment
    targets, or is container normalisation self-hosted-only?

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
