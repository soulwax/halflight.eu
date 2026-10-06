# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A shell-wide notice (desktop and mobile) guiding a listener to connect their own TIDAL
  account, or authorise playback, before anything can play.
- Per-listener request budgets (`429` with `Retry-After`): tighter for search, stream
  metadata, playlist import/sync and taste generation, generous for audio Range requests,
  so one listener cannot exhaust the shared TIDAL app's quota.
- Lyrics now select the active cue against the media clock at cue boundaries, including
  offset-adjusted LRC timestamps and the first upcoming line before lyrics begin.

### Changed

- Last.fm scrobbles now use the media duration when catalogue duration is absent, count only
  actual playback time, and return whether Last.fm accepted or filtered each submission.

- Export hand-off objects are stored under the owner's prefix, so one listener can never
  fetch or delete another's export even with its id.
- `AGENTS.md`, `CLAUDE.md`, `MASTERPLAN.md` and the README now describe Halflight as an open,
  multi-listener service with per-user isolation.
- Product routes, API handlers and the TIDAL/Last.fm connection flows are now open to every
  signed-in, active user (`locals.isListener`); only `/app/admin` still requires an
  administrator. Each listener uses their own TIDAL connection and data.
- The stream-manifest cache is keyed per user and disconnecting only clears that user's
  entries, so signed CDN URLs can never be served across accounts.

- Refresh the README for the current product and remove the old generated screenshots and their capture script.

- Keep actionable playback recovery visible across Halflight Now screens. The shared shell now carries
  remote-playback, unavailable-track, authorization, plan, stream, and fallback recovery with one
  clear next action; the mini player no longer repeats the same recovery controls.
- Unify mobile album, artist, playlist and track actions in the same reviewed action sheet, with
  queue feedback and the correct duplicate-track occurrence preserved for contextual Play Now.
- Remove the `bragi` and `bragi-audio` Git submodules; both are developed in their own repositories and consumed from npm.
- Rebrand the repository to `soulwax/halflight.eu` with homepage `https://halflight.eu`; the `syn` code name is unchanged.
- Plan the next Halflight Now stage in `docs/mobile-listening-experience-plan.md`: Now Playing
  becomes an overlay sheet above the current scene, the tab bar drops to Home/Search/Library,
  and the plan adds per-tab navigation stacks, a verified phone device matrix, and audio
  hardening. `MASTERPLAN.md`'s Halflight Now contracts and the two earlier mobile plans now
  point at it for those superseded compositions. Documentation only; the visual identity and the
  four theme presets are unchanged.

### Added

- Full lyrics views (desktop panel and mobile screen) now follow the synced line as the song plays and pin the upcoming line as a smaller caption.

- Add multi-tier lyrics resolution with eager fetching and community fallbacks:
  cascades from TIDAL v1 API to LRCLIB (exact match, cleaned metadata match, fuzzy search)
  and Lyrics.ovh for plain text. Supports instrumental tracks, metadata query hints,
  L1 in-memory LRU and L2 Redis caching with single-flight deduplication, and exposes
  provider attribution in player state and UI.
- Rework the mobile fullscreen player in the image of Spotify: moody dark vertical atmospheric
  gradient, Spotify-styled context header with provenance eyebrows, centered 8px rounded cover
  with rich ambient shadow, bold left-aligned track identity with release metadata and quality pill,
  prominent circular transport with tactile micro-interactions, a bottom utility row for track
  info, credits, and queue count badge, and a signature Spotify Lyrics preview card linked to
  synchronized lyrics.
- Bring Spotify's Now Playing gestures to Halflight Now. Swiping the cover shows the
  neighbouring track's artwork peeking in, stiffens where there is nothing to go to, and gives one
  haptic tick at the point a release would commit. New artwork slides in from the side playback
  moved to, whether from a swipe, the transport, or a queue pick. Pulling down from the cover
  or the header now carries the whole sheet with it before closing.
- Keep the Now Playing title on one line: a long title scrolls back and forth (pausing with
  playback, static under reduced motion) instead of wrapping into the artwork's space. Add an
  add-to-playlist button beside it, link the "playing from" album back to its page, and show the
  utility row as icons only on narrow phones so its labels never wrap.
- Document the navigation and listening recovery redesign after the iPhone report, including
  mobile entry after sign-in, Now Playing identity taps, resume validation, recovery states,
  content reset scope, and physical-device acceptance gates.

### Fixed

- Extend Halflight Now to the large viewport in standalone PWA mode so the
  fullscreen player uses the space beneath the home indicator; regular mobile
  browsers continue using the dynamic viewport around browser chrome.
- Fit the mobile fullscreen player within the mobile viewport without vertical or horizontal
  scrolling on standard phone dimensions, fluidly scale artwork to available space, eliminate
  redundant safe-area padding in the fullscreen layout, and enable snappy touch response with
  touch-action manipulation.
- Remove browser-facing TIDAL token inspection so access and refresh tokens remain server-only.
- Send narrow-screen sign-ins to Halflight Now, preserve safe return destinations, and make
  mobile and desktop view selection explicit. Open the desktop player from its song title
  while keeping track details as a labeled secondary action.
- Check the restored recording before offering Resume, distinguish playback failures, and
  prevent unknown upstream failures from appearing as permanently unavailable tracks.
- Invalidate pre-reset local queue journals when the new player loads.
- Keep desktop page scrolling within the listening panes above the docked player, with no outer
  document scrolling or scroll chaining beneath it; preserve public and mobile page scrolling.
- Retain queue edits through browser-storage failures, stalled requests, lost acknowledgements,
  and long server outages; retry with stable operation IDs and buffer failed database intents in
  Redis without declaring them committed. Keep save status in compact accessible cloud icons.
- Keep mobile detail retries inside the app so playback survives refresh failures; return detail
  Back controls to the original browse query and filters. Render repeated playlist recordings
  safely, start the tapped occurrence, and retain other copies when shuffling.
- Reduce artwork and metadata latency by resolving request permissions in one fresh database query,
  sharing album artwork requests, reading playback token and market together, and avoiding metadata
  refreshes for optional missing release dates. Retry the desktop cover after a prior image fails.
- Verify TIDAL playback before reporting playlist imports successful; exclude confirmed defective
  recordings from playlist JSON and editing views, pace validation, and stop safely on throttling.
  Keep long import and pull responses active through production proxy timeouts.
- Keep typed lint's extra file extensions consistent so checking mixed TypeScript and Svelte files
  does not repeatedly reload the entire project.
- Batch album/playlist queue additions into one durable operation, let off-screen artwork remain
  lazy, request appropriately sized thumbnails, and prevent touch scrolling from starting a drag.
- Center the desktop seek thumb vertically on the progress line in Chromium and WebKit.
- Confirm track unavailability across quality tiers before excluding a recording, expire negative
  playability records after 24 hours, and preserve the requested quality limit during fallback.
- Refresh mobile library failures without reloading the player; isolate private-upload storage
  failures from saved playlists and retain favorite-list context when starting a track.
- Normalize SvelteKit manifest path records before filtering service-worker precache assets,
  preventing a production registration failure while preserving public-only cache routing.

### Added

- Mobile saved-playlist search by playlist, track, album, or artist with URL-preserved pagination,
  honest saved/available track counts, and clear feedback when unavailable tracks are skipped.
- Labelled mobile Home/Search/Library/Now navigation, adaptive Now Playing controls, contextual
  Close, transport on supporting screens, and a track-action sheet with queue feedback.
- Shared playback and queue-save recovery notices, confirmed queue clearing, and named queue saving
  with pending/error/success states and safe retries after a lost response.
- Mobile full-playback setup with bounded polling, cancellation, and allowlisted OAuth return to
  mobile Settings.
- Overall product UX/UI and mobile playback-controls implementation plans, covering desktop and
  mobile navigation, setup, transport, seeking, recovery, music actions, accessibility, and delivery.
- Track the standalone `bragi-cli` source as the public `bragi/` submodule; its GitHub repository
  owns the cross-platform release workflow.
- The standalone `bragi-cli` package, with npm executables, setup, bounded inspection and
  downloads, WAV/raw PCM tools, saved queues, and a bundled browser playback/conversion companion.
  It has independent package checks and generated-fixture browser and HTTP integration tests.
- An implementation plan for the standalone `bragi-cli` package, covering the
  setup wizard, terminal commands, browser playback companion, library API coverage, and release gates.

### Changed

- Compact queue identity into wrapping title, artist and album lines; remove empty date/duration
  gutters and dash placeholders, and group reorder/remove controls into a narrow column pair.
- Rebuild the Halflight portrait icon from an editable SVG with high-contrast pale artwork,
  a cyan music note, and a consistent dark surface; use a dedicated maskable icon and Apple touch size.
- Make Home resume deliberate, reject duplicate pending starts, use explicit OS Play/Pause actions,
  and align previous/next/seek availability with actual playback commands and mode.
- Confirm playlist-dialog saves on the server before reporting success, and require explicit intent
  for TIDAL publication when creating an owned playlist.
- Preserve narrow layouts with enlarged text, enlarge dialog close targets, and respect reduced
  motion for dialogs.
- Distinguish playback-session service failures from network outages, keep pending edits, and offer
  a translated retry action in the player.
- Rebrand the audio package source submodule, imports, configuration, tests, documentation, and
  GitHub links to `bragi-audio`; depend on the package directly.
- Syn now consumes the published `bragi-audio@0.2.2` package directly,
  pinned in the lockfile instead of depending on a local submodule during deployment.
- Stream metadata loading and validation now run through `bragi-audio/player` for both direct playback
  and look-ahead preloads. Skipping or closing playback cancels foreground stream requests and
  stale responses cannot replace the current track's state.
- HTTP range and retry helpers now come from `bragi-audio/delivery`. The package also provides bounded
  streaming/download APIs and a separate PCM/WAV codec entry; TIDAL playback still proxies source
  bytes through Syn's native streaming path.

- The player's audio engine now lives in the `bragi-audio` submodule's new browser entry,
  `bragi-audio/player`: `AudioEngine` (the `<audio>` element and headroom gain stage), queue identity and
  conflict rebasing, the playback self-check, the next-track preloader, and Media Session wiring.
  `#lib/player/*` keeps thin wrappers for Syn's types, copy, and endpoints. The unused duplicate
  `audio-engine.ts` is gone; `player.svelte.ts` now drives the one engine instead of an inline
  copy.
- The player's length/quality warning ("Preview only — …", "Quality: asked …") and the lock-screen
  "Unknown Artist" fallback are translated instead of always English.

- Private-music uploads now inspect actual audio bytes through the new `bragi-audio` submodule before
  storage. Malformed, renamed, and MIME-mislabeled files are rejected before a bucket write, while
  the detected canonical media type is what Syn persists and serves.
- The listening room's phone-width shell (`/app/**` below 64rem) drops the bottom tab bar, whose
  labels overflowed and clipped ("Sign out" was unreadable). A hamburger in the header opens a
  slide-in menu with an icon for every destination plus Administration (administrators), Settings,
  and Sign out; Search and Library stay one tap away as header symbols and flag the current page.
  This also restores navigation between 48rem and 64rem, where the old bar was hidden while the
  side rail was not yet shown.

### Fixed

- The docked player keeps clear of the home indicator on notched phones now that the bottom bar
  that carried the safe-area inset is gone.

## [0.3.5] - 2026-09-21

### Changed

- Mobile navigation now follows a focused priority pattern: a keyboard-accessible hamburger
  opens the complete navigation sheet, while Search and Library remain immediate Lucide actions
  in the persistent header. Home, Now Playing, and Settings remain one tap away in the sheet.

## [0.3.4] - 2026-09-21

### Changed

- Mobile primary navigation now lives in the persistent top header and uses compact Lucide icon
  controls. Accessible names and tooltips preserve the Home, Search, Library, Now Playing, and
  Settings destinations while leaving the bottom edge clear for the mini player.

## [0.3.3] - 2026-09-21

### Fixed

- Restoring a queue that contains recordings no longer exposed by TIDAL now recognises those
  recordings as unavailable instead of misreporting them as retryable 502 errors and repeatedly
  requesting their metadata. Initial restoration also bounds metadata lookups, keeping
  `/app/library` responsive with large legacy queues.
- Playback-state updates now serialize the active-device lease timestamp correctly inside their
  conditional database update, fixing the server-side `Date` serialization error that prevented
  otherwise valid queues from being saved.

## [0.3.2] - 2026-09-21

### Fixed

- TIDAL playlist imports now request paginated track metadata through TIDAL's required nested
  include path. This fixes the provider's HTTP 400 response for otherwise valid playlists with
  more than the initial page of tracks.
- The import dialog now names playlists that TIDAL could not import, while server diagnostics log
  a safe failure category and upstream status without exposing provider payloads to the browser.

## [0.3.1] - 2026-09-21

### Fixed

- Playing a legacy or imported playlist no longer fails to save its queue when a playable track
  has no credited artist metadata. The queue protocol now accepts the `TrackSummary` form already
  supported by the player, instead of rejecting the entire playlist replacement.

## [0.3.0] - 2026-09-21

### Fixed

- Queue edits are now journaled locally with their idempotent operation IDs before dispatch, so a
  reload, offline period, page lifecycle boundary, or SPA navigation cannot silently drop an
  add, remove, move, clear, or reorder. On the next authenticated session restore, the server
  snapshot remains authoritative and only unacknowledged queue edits are replayed against it.
  Already accepted entries are recognised by their stable queue-entry IDs and never duplicate.
- Desktop and mobile SPA shell transitions now flush pending session persistence while leaving the
  mounted player and active audio intact. Returning from Halflight Now to the Listening Room also
  restores desktop origin attribution for subsequent session writes.

## [0.2.0] - 2026-09-18

### Added

- Browser-level coverage now exercises player transport actions, duplicate queue occurrences, queue
  playback and reordering, and the TIDAL playlist import modal's selection and POST flow.
- Unplayable TIDAL tracks are now tracked and hidden. A track is checked lazily — only when an
  actual play attempt fails with "asset not ready for playback" — and the result is cached in a
  new `track_playability` table, never via a proactive library sweep. Every track listing on both
  sites (playlists, albums, artists, search, library, mixes, home, and track radio) filters these
  out server-side, so a broken recording disappears from view instead of erroring mid-play.
- The player now mirrors its current queue, track, and history to `localStorage` as an
  instant-paint seed for the next page load. It is never authoritative: the server-restored
  session always supersedes it as soon as that request resolves, so a stale or cross-device-edited
  local cache never lingers.
- Noir, a tenth selectable Halflight theme. A near-black canvas and stark off-white ink carry a
  single blood-red action colour; a hard, unblurred rim-light shadow stands in for a drop shadow
  since a dark offset would vanish into the canvas, tight corners, and slow, deliberate motion sit
  under tall, uppercase, wide-tracked serif headings styled like an old cinema title card. It is
  available in both Appearance pickers and keeps the mobile browser chrome in the same near-black.
- Aurora, a ninth selectable Halflight theme. Its deep-navy canvas, teal action colour, and
  two-hue jade-and-violet glow (instead of a drop shadow) evoke a drifting night sky; soft rounded
  geometry, slow patient motion, and thin, wide-tracked headings make the listening room feel
  unhurried and luminous. It is available in both Appearance pickers and keeps the mobile browser
  chrome in the same deep navy.
- Riso, a bright print-studio Halflight theme. Warm paper, inky blue, coral offset shadows, and
  compact corners give the listening room a tactile, imperfectly registered character; its choice
  is available in both Appearance pickers and uses the same paper tone for mobile browser chrome.
- Terrarium, a selectable Halflight theme. Its moss-dark canvas, botanical jade action
  colour, softened glass-like geometry, layered green depth, and old-style serif headings make a
  listening session feel cultivated rather than manufactured. It is available in both Appearance
  pickers and keeps mobile browser chrome in the same forest ink.
- Library is now built around the owner's music, not only the provider collection. Desktop places a
  private “Your music” shelf ahead of custom playlists and a clearly-labelled TIDAL section; the
  mobile Library adds the same independent tab. Both show precise storage usage, accepted formats,
  drag-and-drop/file-picker uploads with byte-level progress, safe inline listening through Syn's
  authenticated proxy, an explicit download action, and a confirmed permanent deletion action.
  Private music works without a TIDAL connection and is intentionally kept out of the permanent
  TIDAL-only player queue for this first release.
- Private-music uploads now have one explicit format contract: MP3, FLAC, AAC, M4A, Ogg, WAV, and
  WebM are accepted through browser MIME aliases or a recognised filename extension, then stored
  with a canonical media type in the isolated owner-only bucket. The private-music API lists these
  formats for the upcoming library upload surface, while its authenticated media proxy now serves
  audio inline for listening and uses `?download=1` for an explicit attachment download; byte
  ranges, validators, `nosniff`, and bucket-URL privacy remain intact.
- Blue Hour, a fifth selectable Halflight theme. Its deep indigo canvas, sea-glass accents,
  cloud-soft geometry, diffuse moonlit depth, rounded headings, and patient transitions make the
  post-dusk listening room feel distinct from Dark, Warm Night, and Electric. It is available in
  both Appearance pickers and keeps the mobile browser chrome in the same midnight blue.
- Four selectable themes — Halflight Dark (the original), Light, Warm Night, and Electric — under
  a new `/app/settings/appearance` page (and a matching section in Halflight Now's Settings). Each
  is more than a palette: Light's headings set in an editorial serif over a crisper, flatter frame;
  Warm Night rounds every corner and trades hard shadows for a warm amber glow, with gentler
  motion; Electric turns headings into an uppercase monospace readout inside sharp, near-square
  edges lit by a neon glow instead of a drop shadow, with snappier transitions throughout. The
  choice is saved per account in a new `user_appearance` table and follows the owner to every
  device; a signed-in request always re-syncs it into a fast, non-sensitive `hf-theme` cookie so
  anonymous pages (sign-in, offline) keep the last-seen look without a database read. The palette
  is baked into the very first byte of HTML via `hooks.server.ts`, so there is no flash of the
  wrong theme on load, and picking a new one applies everywhere instantly, without a reload. Every
  theme's picker swatch renders in its own real colours, radius, and shadow (style lives once, in
  `layout.css`'s `[data-theme]` blocks — nothing is duplicated into TypeScript), and adding another
  theme needs no database migration and no component change: four small, compiler- and
  test-enforced touches, documented in `#lib/theme.ts`.
- Generated sets can now be reviewed one slot at a time. Swap draws the next replacement from a
  bounded, deterministic candidate pool returned with that one generation — repeated swaps rotate
  through the whole pool instead of flipping between two tracks — keeps neighbouring slots free of
  the same artist where it can, and updates the set's duration and discovery summary before any
  playback or save action. Keyboard focus stays on the swapped slot, and screen readers hear which
  track replaced which. It makes no extra TIDAL request and never persists the pool.

- Halflight now opens on a single dark listening canvas across desktop and mobile, with neutral
  elevated surfaces and a restrained blue playback accent so artwork supplies the changing colour.
  Both shells use the lowercase wordmark instead of asking a tiny illustrated icon to identify the
  service, and the installed mobile launch colours match the live interface.
- The empty mobile Now Playing destination is a useful part of the app instead of a blank dead end:
  it keeps the compact header and primary tab bar, explains the idle state, and offers direct Search
  and Home actions with full-size touch targets.
- The wide Listening Room queue is now an intentional context drawer. It consumes the right column
  only after the queue action is opened, closes from its own header, and avoids duplicating the same
  queue beneath the docked player; narrower desktops retain the existing expanded-player panel.
- Mobile Search and Library now protect the track title as the primary tap target. Play-next,
  queue, radio, and playlist actions live in the same accessible overflow menu used elsewhere,
  instead of compressing every result behind four adjacent icon buttons. Saved playlists keep a
  compact play/queue pair beside their identity rather than repeating two full-width action bars.
- The Listening Room Search route now owns its search field. The global header search remains
  available everywhere else but steps aside on that route, removing two competing inputs for the
  same task.

- Library-style track lists now use the same player-first action hierarchy as cards: a single
  labelled overflow menu replaces repeated play-next, queue, radio, and playlist buttons, while
  the track currently in the player remains visibly highlighted. The full track-list context is
  retained when choosing Play now from that menu.
- A more direct, player-first control model across the listening surfaces. Track cards now have one
  clear Play control and a compact, keyboard-accessible More actions menu for play-next, queue,
  radio, and playlist actions. The persistent player follows the same rule: queue, lyrics, and
  expansion remain immediately available; saving, docking, TIDAL handoff, and closing live in one
  labelled overflow menu. The desktop rail now makes Home, Search, and Library the clear primary
  loop, separates mixes and curation, and keeps account configuration with the signed-in account.
  This preserves every existing action while making the listening path legible at a glance.
- The first Storybook coverage for the shared UI primitives: `Button`, `Badge`, `SectionHeader`,
  and the new `ViewHeader` (25 stories total), running through `@storybook/addon-vitest` with
  `@storybook/addon-a11y` on every story. The toolchain has been fully configured since the
  project's scaffolding but held zero story files.
- `ViewHeader` — the one header a top-level view gets: eyebrow, a single hero line, and an optional
  supporting sentence. Nine routes (`/app`, `api`, `generate`, `library`, `mixes`, `search`,
  `settings/lastfm`, `settings/taste`, `settings/tidal`) had each hand-rolled this and drifted into
  four different `<h1>` treatments from 24px/600 to 56px/800/uppercase, despite `layout.css`
  already commenting `--fs-2xl` as "the one hero line per view, no bigger". All nine now share one
  component and are pinned to the token, not a route-local rule.
- `Notice` — a short inline message about what just happened: a connection succeeded, a save
  failed, a query was rejected. Eight surfaces had written their own version (`.notice` twice
  with different variant names, `.state-error`, `.generator-notice`, `.form-error`/`.form-success`,
  `.api-console-error`, `.notice-box`, and a Tailwind clone in `settings/taste`), and they
  disagreed about geometry, colour, and which ARIA live-region role to use. All eight now use the
  primitive, which picks the role from the tone: a failure interrupts (`alert`), anything else
  waits its turn (`status`).
- The six `HALFLIGHT // …` view eyebrows are now catalogue messages with German translations.
  They had been English literals in markup all along; `i18n-coverage.spec.ts` never caught them
  because the guard skips any string with no lowercase letter, and these are set in caps.
- `i18n-coverage.spec.ts` now also catches copy hardcoded into a component _prop_ —
  `ariaLabel="Export as M3U8 Playlist"`, `title="MY CUSTOM PLAYLISTS"` — not just visible text
  nodes. One of these had sat in `/app/library` since before the original sweep; the aria-label
  case is worse than a visible miss, since it reaches only screen-reader users. Fixed three such
  strings across `albums/[id]`, `playlists/[id]`, and `library` while hardening the guard.

### Fixed

- Player timeline clocks and volume tracks now use explicit centered geometry. Volume hydration no
  longer resets a locally chosen level to the server's 100% default, and returning below headroom
  restores the native audio level after a Web Audio gain graph has been used.
- Every theme's "beyond colour" identity — radius, shadow, motion, heading typography — silently
  fell back to Dark's values everywhere, regardless of which theme was active. `layout.css` had the
  shared, un-themed defaults declared _after_ the four theme blocks; since `:root` and
  `[data-theme='…']` match the same `<html>` element at identical specificity, the later block wins
  for any property both declare, so the defaults always overrode every theme's own customisation.
  Colours still varied correctly (each theme's colour tokens have no competing default to lose to),
  which is exactly why this went unnoticed through code review and every test in the suite — the
  bug was invisible to both. Caught only by actually running the app and reading real computed
  styles from a live browser, not by reasoning about the CSS from source: `--radius-md`, `--shadow-panel`,
  and `--font-heading` all read back as Dark's value in every theme until this fix, confirmed with a
  throwaway inspection script before and after. Reordering the shared defaults before the theme
  registry fixes it; a hazard comment at both ends of the reorder explains why the order is load-bearing.
- `ViewHeader`'s `<h1>` — the one hero line shared by nine top-level routes — hardcoded its own
  font weight and letter-spacing, so none of it ever showed a theme's heading identity: Electric's
  uppercase monospace readout, Light's editorial serif, nothing reached the single most visible
  heading in the app. It now inherits them from `layout.css`'s shared rule like the real `<h1>` it
  is. Caught by fixing the previous Storybook gap and actually looking at what a theme switch would
  show; a new test pins it by proving a red run against the old code, not just a passing one now.
- The sign-in page's own `<h1>` — the actual first thing any visitor sees — had the same problem
  one property narrower: a hardcoded `letter-spacing` blocked only a theme's heading tracking, while
  its weight and family already inherited correctly. Removed and verified against a running dev
  server across all four themes; Electric's wide tracking on the uppercase monospace heading reads
  as intentional even at this heading's much larger size, not a mistake.
- Storybook rendered every story with no design tokens at all: `layout.css` was never imported
  into its preview, since the real app only loads it through the root layout Storybook doesn't run
  through, so buttons, badges, and every other component showed with unset colours, radii, and
  shadows. Fixed, and its toolbar now carries a theme switcher built from `#lib/theme.ts` — the
  first genuinely accurate, live reference for all four themes; `docs/style-guide.html`, which
  predates the token system entirely, no longer claims to be one.
- A queued or resumed track whose display metadata failed to load during a connection blip no
  longer shows "Track details are unavailable" for the rest of the page's life. The one-shot
  hydration fetch now retries a transient failure (a dropped connection, an upstream 5xx) up to
  three times with backoff, while a confirmed 404 is still left alone rather than retried forever.
  Opening the queue also asks again immediately, instead of waiting out the backoff.
- Generated-set explanations no longer arrive as English sentences baked by the server. The taste
  pipeline returns structured evidence, then desktop and Halflight Now render the reason in the
  active locale. Runtime is now honest too: provider-known duration and missing coverage are kept
  separate, any estimate says so, and summaries describe picks as outside the owner's anchors
  rather than claiming untracked listening history.
- The player dock now follows the familiar three-part playback model: track identity on the left,
  transport with its timeline in the centre, and queue/lyrics/session utilities on the right. Its
  controls have dependable targets, the seek input has a full-height hit area, and artwork is no
  longer a hidden duplicate play/pause button. Play now becomes Pause while audio is running—not
  the unrelated “Collapse player”—and selecting an already active detail tab no longer closes the
  player. More actions now opens the specifically named Playback details panel instead of
  unpredictably reopening a remembered panel. Player chrome uses the style guide's neutral surface
  and blue action colours; gold remains reserved for actual HiRes/headroom meaning.
- The generated-set review no longer switches back to an older, denser visual language after the
  newly composed builder. Its listening summary now uses the shared module contract, track actions
  have a dependable 40px target, provenance reads as supporting evidence rather than all-caps
  telemetry, and saving announces a durable result to assistive technology as well as visually.
- `score.ts` accepted an `artistCounts` option and computed its own static artist-repeat penalty,
  but `generate.ts` never populated it — permanently unreachable from the real generation pipeline,
  exercised only by its own test. The real, dynamic version of this penalty already lived in
  `sequence.ts`, which — unlike a pre-selection snapshot — can actually track how many times an
  artist has been picked as selection proceeds. Removed the dead option and its computation from
  `score.ts`; `ARTIST_REPEAT_PENALTY` stays there since `sequence.ts` already imports it from that
  module.
- Two surfaces told success from failure by text colour alone — `settings/lastfm`'s
  `.success`/`.error` and `sign-in`'s `.form-success`/`.form-error` were identical but for the
  colour of the words. `Notice` always carries a tone icon as well as a tint, so the distinction
  survives for anyone who cannot see the difference.
- `settings/tidal`'s "reconnect before saving playlists" warning had been rendering as a neutral
  grey notice: it asks for `.notice-warning`, and that class is defined nowhere — the same silent
  no-op the `ghost` button variant had. It is a real warning tone now.
- The app header was being clipped. `AppHeader` asked for 56px, and 64px above the `sm`
  breakpoint, inside a grid row fixed at `--shell-header-h: 3.25rem` (52px) with
  `overflow: hidden` — so its own bottom hairline was cut off entirely and its vertically
  centred content sat about 6px below optical centre on every desktop width. The shell row is
  now the single source of truth at 3.5rem and the header fills it, setting no height of its own.
- The header and the content below it now start at the same left edge. `AppHeader` hardcoded
  `px-4 sm:px-6` while `.app-shell-main` uses `var(--shell-gutter)`, so the brand mark sat a few
  pixels inside or outside the content column depending on viewport width — visible as a wobble
  in the one vertical line the eye follows down the page.
- `HeaderSearch` — the most-looked-at chrome in the app — carried three radii outside the
  six-step family (13.6px, 10px, 8px). It uses the tokens now.
- Removed 112 lines of dead CSS from `layout.css`: a `@layer components` block labelled "Unified
  Track Row" with seven rules that no markup anywhere references, while four real track-row
  implementations live elsewhere. A shared layer nothing uses is worse than no shared layer,
  because the next person reads it as the system.
- `settings/tidal` was the last route contradicting the card and button systems outright: 2px
  borders against the app's 1px hairline, a private fourth button implementation (uppercase 800,
  `--radius-sm` where every other button is `--radius-md`, and a `translate(-1px, -1px)` hover —
  the hard-offset idiom the design direction retired), and a `var(--radius-lg, 14px)` fallback
  that claimed a different geometry than the 12px token it fell back from. Its cards now consume
  the `--module-*` contract and its buttons are the `Button` primitive.
- The `--module-*` contract now has more than one consumer, and the four card classes that were
  declaring it longhand defer to it instead of restating it with `box-shadow: none`.
- `--shell-inset` was a vestigial hook, permanently `0`, feeding a `gap` and a `padding` that
  could therefore never do anything. Removed.
- `pnpm test:unit` is deterministic again. The `client` and `storybook` projects each drive their
  own headless Chromium pool, and at the default worker count the pair oversubscribed an 8-core
  machine badly enough that interaction tests missed the 15s timeout — a different two to eight of
  them on every run, which read as flakiness rather than as a resource ceiling. Every one of them
  passed in isolation, and each project passed alone. `maxWorkers: 3` bounds the pool: 845/845
  across repeated runs, at no wall-clock cost.
- `Button`'s `ghost` variant had no CSS of its own — `.btn-ghost` never existed, so it mapped to
  the empty string and rendered identically to `secondary` at all nine call sites. Wherever the
  two sat together the hierarchy read as flat. Ghost is now the genuine third weight: no border or
  fill at rest, a soft sky wash on hover, so the bordered secondary beside it stays the stronger
  offer.
- `/app` Home offered the same thing twice. Its resume card's last branch invites the listener to
  generate a set, and a standing generation band two rows below repeated that invitation in a
  second card treatment — so the emptiest possible Home was the one that shouted loudest. The band
  now appears only when the resume card is offering something else, and the resume card's eyebrow
  says which of the two it is. Home also moved onto `ViewHeader` and `SectionHeader`, which
  removes its private `.eyebrow` fork (weight 650 / tracking .11em against the shared 600 / .08em)
  and the two differently-shaped "see more" affordances that sat in identically-shaped headings.
- `settings/lastfm` styled its buttons with bare `button` and `.button` element selectors — a third
  private button implementation, at `--radius-sm` where every other button in the app is
  `--radius-md`. It uses the `Button` primitive now.
- `Badge`'s `tag` variant — used by the taste settings page's confidence badge for every level
  below "high" — had no template branch of its own and fell through to the `quality` branch,
  running the audio-quality-tier classifier on a whole sentence. Harmless only by coincidence,
  since that classifier's fallback colour happens to match what a plain tag should look like; a
  future change to quality-tier styling could have silently broken it. Now its own explicit branch,
  same rendered colour.
- Retrying a queue edit after a lost response is now correctly recognised as the same operation
  and replayed from the cached result, instead of being rejected as invalid. The server's
  idempotency check hashed the whole intent including `expectedRevision`, but the client sends its
  own current revision on every attempt — so a retry sent after rebasing onto a revision it learned
  about in the meantime hashed differently from the original request and came back `400 invalid`,
  a status the client had no way to recover from.
- A queue command that can never apply — most often a remove or move naming an entryId another
  device already removed — is now dropped instead of retried forever. Previously it stayed at the
  head of the buffer and blocked every command queued behind it indefinitely, since the client
  treated that failure identically to a transient network drop. A new `rejected` persistence status
  tells the owner an edit was discarded without touching the rest of their queue, and clears itself
  on the next clean save rather than needing to be dismissed.
- An expired session is now reported as itself instead of as a connection problem. All four places
  the player talks to `/api/playback-state` — sending a queue command, saving the resume snapshot,
  refreshing after a conflict, and the background poll that keeps other tabs in sync — treated a
  `401` identically to a dropped network request or a malformed response, so "Your queue has not
  been saved. Check your connection and try again." was shown for a session that had simply ended,
  telling the owner to do the one thing that could not fix it. The background poll was the worst
  case: its failure path changed nothing visible at all, so a session ending in one tab surfaced
  nowhere. A new `unauthenticated` status now shows a distinct message with a sign-in link, and
  clears itself the same way `offline` already does once a request succeeds again.

## [0.1.0] - 2026-09-11

### Added

- A branded, localised error page (`src/routes/+error.svelte`). Every 404 and 500 previously
  rendered SvelteKit's unbranded default.
- `src/lib/i18n-coverage.spec.ts` fails the build when a user-facing string is added to a product
  surface without going through the catalogue, and when the two catalogues fall out of key parity.
  The developer-only diagnostics area is allowlisted per the product boundary that lists it
  separately from English/German UI parity.

- Halflight generation now reports truthful finding, matching, and sequencing stages on both the
  Listening Room and Halflight Now. The enhanced forms stream only safe counts, can be cancelled,
  and ignore a late superseded response; their normal form actions remain available without
  JavaScript. Each graph read is cancellable and limited to five seconds within the existing
  nine-second overall budget, so a slow provider request degrades a set instead of leaving the
  listening surface indefinitely busy.

- Halflight Now can now make a concise, reviewable generated set from Home: choose a short length,
  familiarity, and (when available) one top artist anchor, then play, save, or export the provisional
  result without entering the desktop Listening Room.

- Expired HiRes cache objects are now reclaimed by a sweeper. The cache bucket supports neither
  `ListObjects` nor lifecycle rules — verified against the live provider, which answers
  `NoSuchKey` to both — so nothing could enumerate it to find expired objects, and the cache's own
  deletion is lazy: it only fires when a _read_ finds an object already past its expiry. An object
  written and never read again was therefore unreclaimable. Syn now records each key it writes in
  `tidal_cache_object` and deletes expired ones from that index, in bounded batches, piggybacked
  on cache writes so no scheduler is needed. Rows hold an opaque digest, a size, and a timestamp —
  no track identity, no URL, no audio. A failed delete keeps its row for a later run, and a
  failing sweep can never affect playback.

- The taste engine now has an era knob: pick a decade on `/app/generate` and picks are scored by how close their release year sits to that centre (±8 years), a transparent request-fit term that stays neutral for undated tracks so it only ever nudges.
- The taste engine now has a minimum-length knob that filters out interludes and skits below the chosen floor (1 / 1.5 / 2 minutes); tracks with an unknown duration are kept.
- The taste engine can now exclude explicit tracks from a generated set (an `/app/generate` checkbox); the explicit flag now travels through the candidate pipeline, and a track with no flag is kept.
- Generated per-track provenance chips ("From {artist}, one of your anchors", "Similar to {seed}", …) are now rendered through Paraglide in the request locale instead of hardcoded English.
- The generated set summary, cold-start message, and saved-playlist title/description are now localised too, and the set's confidence is a stable token (`none`/`initial`/`good`/`high`) resolved to a label in the request locale rather than an English string matched by prefix.
- Taste-graph expansion now paces its upstream calls (120ms gap by default, no delay before the first) so a full run no longer risks TIDAL's sustained-probing rate limit.
- Taste-graph expansion now has a wall-clock ceiling (9s default) alongside its request budget, so a slow TIDAL can no longer stall generation — expansion stops where it is and returns a partial, `degraded` result.
- PWA persistent background playback on iOS (WebKit lockscreen/remote command center) and Android (MediaSessionCompat/notification shade).
- Web Audio graph mobile bypass preserving standard HTML5 audio background privileges across screen lock and tab suspension.
- Service Worker precaching app shell assets and neutral `/offline` fallback within strict < 2 MiB budget while bypassing audio streams, Range 206 requests, and authentication endpoints.
- MediaSession integration with origin-qualified absolute artwork URLs and scrub bar position synchronization.
- Emily the Strange ("Music With Many Paths") brand mark rasterized and integrated across desktop and mobile headers, sign-in, Apple Touch Icons, and web app manifest.
- Accessible headless UI primitives (`Dialog` and `DropdownMenu`) built on `bits-ui` and Halflight design tokens with full keyboard navigation and focus management.
- Accessible `PlaylistDialog` replacing legacy modal with accessible title, description, live focus trapping, and inline new playlist creation.
- Unified `TrackActionMenu` on desktop track tables and mobile track rows (Play now, Play next, Add to queue, Start track radio, Add to playlist).
- Drag-and-drop queue reordering via `svelte-dnd-action` keyed by unique `entryId` for desktop and mobile touch, supporting duplicate tracks and single-commit persistence with zero audio interruption.
- Automated accessibility suite using `@axe-core/playwright` validating WCAG compliance on authenticated surfaces.
- Extracted pure `PlaybackSessionCoordinator` decoupling playback session persistence, retry backoff, and 409 rebase logic from DOM player reactivity.
- Property-based test suite using `fast-check` mathematically verifying queue bounded-length invariants, independent lifecycles for duplicate TIDAL track entries, clear dominance, and non-destructive relative ordering.
- Deterministic multi-client race tests validating queue edit survival and idempotent intent retries during concurrent Listening Room and Halflight Now playback.
- Desktop search, album, and playlist track tables now expose the same Play next, Add to queue, and
  Start radio actions as the rest of the Listening Room; queue rows retain their specialised edit controls.
- Listening Room and Halflight Now now reconcile newer server session revisions while visible, with
  bounded retry backoff and immediate refresh on focus or reconnection. Remote state never starts,
  pauses, seeks, or replaces locally loaded audio.
- An owner-only Swagger-like API workbench now documents Syn’s supported endpoints, shows request
  and response shapes, copies paths, and can execute a curated set of read-only same-origin calls.
- The API workbench can now download its authenticated OpenAPI 3.1 document for compatible local
  tools without disclosing account or object-storage credentials.
- Generated taste results now use a reusable listening-set module with set-level playback, save, and export actions plus an explainable per-track sequence.
- The wide Listening Room now has a pinned queue context panel; its queue controls and track tables adapt to the width of the shell region that contains them.
- Owner-uploaded private music can now be listed, downloaded, and deleted through authenticated API routes backed by a separate S3-compatible bucket.
- Private-music downloads now support authenticated byte ranges, cache validators, and `HEAD` metadata probes for resumable downloads.
- Private music can now export owner-only M3U and JSON manifests; explicit hand-offs use the short-lived export bucket.
- The private-music collection now reports file count and upload capacity from safe owned metadata.
- Owner-requested playlist exports can now use an isolated, short-lived S3-compatible bucket through authenticated Syn download URLs.
- A neutral, public `/offline` page for the future PWA navigation fallback, with no account, theme, or session data in its response.
- Halflight Now now has an installable-shell manifest, owned standard and maskable icons, mobile-only app metadata, and a Settings installation/help flow.
- Playback-session protocol documentation and a deterministic two-client optimistic-concurrency race test.
- Playback-state snapshot and queue-command inputs are now structurally validated at the server boundary.
- Halflight Now album, playlist, artist, and track detail compositions: their own mobile routes (`/albums/[id]`, `/playlists/[id]`, `/artists/[id]`, `/tracks/[id]`) with hero artwork, play/shuffle/add-all (and artist/track radio) verbs, per-track actions, an artist album rail and track album/artist links that cross-navigate within Halflight Now, and honest disconnected/not-found/unavailable states — every mobile search result and saved playlist now opens in Halflight Now instead of handing off to the desktop shell, and each detail route also stands alone as a deep-link target.
- Halflight Now Home now carries a compact personal daily-mix rail below the resume card, tapping a cover plays that track in the context of the whole mix.
- Halflight Now Playing now has shuffle and repeat controls flanking the skip buttons, with an accent-lit active state and haptics.
- Halflight Now search with live grouped results and direct queue controls for tracks.
- Halflight Now Library with saved playlists, paginated favorite tracks, queue controls, and a reviewed queue-replacement action.
- Property-based generator tests that protect candidate eligibility, cooldown, deduplication, and input-immutability invariants.
- Header search with grouped live-result dropdowns, keyboard navigation, and a full-results fallback.
- Consistent track actions for play next, queue, and track radio across cards and desktop track tables.
- A focused Halflight Now Home and Now Playing shell sharing the authenticated listening session.
- Halflight Now settings for saved stream quality, default volume, loudness normalization, and TIDAL connection state.
- Halflight Now now exposes provenance and actual playback quality, with focused lyrics and contributor-credit views.

### Changed

- Every user-facing string on the product surfaces now goes through the message catalogue in both
  English and German. The catalogues were already at full key parity — the gap was copy written
  straight into markup, which produced no missing-key count precisely because nothing called `m.*`
  for it. 39 such strings across `/app/generate`, `/app/settings/taste`, `/app/tracks/[id]`,
  `/app/playlists/[id]`, `MediaCard`, and `PlaylistImportModal` are now localised.
- `/app/generate` lost its operational jargon along the way: "Session Intent Knobs", "graph
  neighbourhood", "deterministic", and "Whole Taste Profile (All Anchors)" are gone in favour of the
  plain wording the mobile twin already used. The two pages now share `generate_*` keys rather than
  keeping parallel `mobile_generate_*` copies, so they cannot drift apart.
- `/api/private-music/export` writes `#PLAYLIST:Halflight private music` instead of the old project
  name into every exported `.m3u`.

- The album, artist, track, and playlist page headers now show a plain type label ("Album", "Artist", …) above the title instead of the `HALFLIGHT // X SPECIFICATION` developer eyebrow.
- The Listening Room header's inner elements now share one control metric — the brand mark, search field, and every icon button are the same height, radius, border, and hover treatment — and the search field grows to a 34rem cap instead of a fixed narrow width.
- The rail collapse toggle now matches the nav links beside it (same radius, muted-to-hover treatment, a real panel icon instead of a `‹`/`›` glyph), the collapsed-rail monogram fallback drops its stray gold border for the standard hairline, and the rail's sign-out button now settles into the same danger tint (border, text, and subtle fill) as the header's.
- Halflight Now now presents Data saver, Balanced, and Best available as clear mobile streaming
  choices, while Now Playing continues to show the format actually delivered.
- Halflight Now’s player and its queue, lyrics, and credits layers are now full-screen mobile
  scenes. They no longer retain the app header or tab bar, and all player/queue controls meet the
  48px touch-target contract.
- Halflight's canonical logo is now the aurora-gradient portrait mark on a white rounded plate with
  a soft glow, rebuilt reproducibly from one source SVG (`scripts/generate-logo.sh`) across the
  browser icon, installed PWA, desktop and mobile headers, and sign-in surface. The PWA splash now
  matches the light system instead of the retired dark background.
- The Halflight light system is now the only palette in the app: status colours, dialog backdrops, and artwork scrims come from semantic tokens instead of Tailwind defaults and stray blacks, and the leftover dark-theme surface names that silently dropped their backgrounds are gone.
- Queue reordering is now usable without sight: moving an entry announces its new position through a polite live region in English and German, and focus stays on the control you pressed — or moves to the opposite direction when the entry reaches an end and its own button becomes disabled.
- Halflight Now’s home masthead now comes from the shared screen header at a `masthead` tone, so the front-door and interior screens differ by one prop instead of duplicated type and rule styling.
- Halflight Now’s layered screens — lyrics, credits, and queue — now share one sub-screen header: a consistent back control, heading focus target, and current-track context line.
- Halflight Now settings now use the shared sub-screen header and the editorial rounded-card family instead of a bespoke header and flat panels.
- Halflight Now search and library now share one editorial screen masthead with the home surface: display heading, hairline rule, and the same responsive page rhythm.
- Reframed Syn around the mobile-first Halflight light system: deep-blue ink, paper surfaces, sky selection, and restrained blush editorial accents now carry the desktop shell, player, and mobile chrome.
- Reworked the Listening Room’s desktop hierarchy around a compact, recognisable docked player,
  quieter rail and header controls, and denser music-first home and track-card compositions.

### Changed

- HiRes (segmented DASH) playback now starts streaming instead of buffering the whole track
  first. A parallel `HEAD` sweep establishes the total size, fragments are written into one
  pre-allocated buffer and emitted as they arrive, and the response still carries a correct
  `Content-Length` so seeking keeps working. A CDN that refuses `HEAD` falls back to the previous
  buffer-first behaviour. Assembly is single-flighted, so concurrent first-plays of one track
  download it once, cancelled openings abort their pending fragment requests, and range slices are
  served as views rather than copies.
- HiRes assemblies can now use an explicitly enabled, isolated S3-compatible cache across reloads.
  It never exposes a bucket URL, streams valid cache hits through Syn with Range support, uses only
  opaque hashed keys, limits objects to 128 MiB, and marks them for deletion after 15 minutes.
  The cache remains disabled unless its dedicated configuration and explicit permission gate are set;
  any bucket error falls back directly to TIDAL.
- `/api/tracks/[id]/audio` now sets `Cache-Control: private, max-age=600` with an `ETag` covering
  track _and_ delivered quality, honours `If-None-Match` and `If-Range`, and answers `HEAD`. It
  previously sent `no-store`, so every backward seek and replay re-fetched from origin; a
  conditional request is now answered without reaching the CDN at all.
- Manifest resolution for playback is now memoised. `/api/tracks/[id]/audio` re-ran the full
  resolve on every request — so once per seek — and `/api/tracks/[id]/stream` ran it again
  independently, meaning pressing play resolved the same manifest twice. A two-tier cache
  (process-local in front of the shared Redis cache) with a single-flight guard collapses the
  concurrent pair into one upstream call and serves a seek burst without touching TIDAL. Entries
  live 120 seconds, are dropped on disconnect, and are sealed with the same AES-256-GCM key used
  for the token rows, because a manifest holds signed CDN URLs. Both tiers fail open.
- `/api/tracks/[id]/audio` no longer calls `getConnectionStatus()`. It cost two Postgres reads and
  two AES-GCM decrypts per request to derive errors the route already produces from the resolve.
- The owner's streaming settings are memoised for 30 seconds instead of being read from Postgres
  on every app-shell render and every audio request; saving preferences refreshes it immediately.
- `playbackinfopostpaywall`, the CDN media proxy, and each DASH fragment fetch now retry transient
  5xx/408 responses with exponential backoff, matching what the JSON:API surface already did. One
  transient failure previously killed a play outright — and for HiRes discarded an
  already-mostly-downloaded concatenation.

### Fixed

- The durable HiRes cache's object-store client now bounds every call: a 2s connect timeout, a
  15s socket-inactivity timeout, one retry instead of the SDK's three, and a 2s deadline on the
  metadata probe. `head` and `get` are awaited on the audio path, so with the SDK defaults an
  unreachable store could stall playback indefinitely rather than degrading to a cache miss —
  the same discipline `#lib/server/cache` already applied to Redis. The streaming `get` body
  deliberately carries no operation-wide deadline, which would abort a track mid-download.

- A TIDAL BTS manifest that declares any encryption other than `NONE` is now refused with a clear
  error naming the track. Syn proxies CDN bytes verbatim and has no content-key handling, so such
  a stream would previously have been served as plausible-sized, unplayable audio — surfacing as
  an opaque `MediaError` decode failure with nothing recorded about the real cause. Every manifest
  observed so far reports `NONE`; an absent field is still treated as unencrypted.
- Dragging the desktop seek bar now moves the audio element once, on release, instead of on every
  step of the drag. Each `currentTime` write can provoke a fresh Range request, and because the
  audio proxy re-resolves the TIDAL manifest per request, a single scrub gesture could fan out
  into hundreds of upstream API round-trips. The thumb still tracks the pointer, an interrupted
  drag is discarded, and a track change mid-drag no longer commits the old position against the
  incoming track. Matches the behaviour the mobile now-playing screen already had.
- Queue rows now use a localised unavailable label instead of exposing an unresolved TIDAL track,
  artist, or album identifier while live metadata is recovered.
- Restored and synchronised queues now hydrate legacy identifier-only tracks in bounded batches,
  so queue and history rows resolve to their real TIDAL metadata without delaying playback.
- PM2 reloads now apply pending database migrations before rebuilding, preventing playback-state
  persistence from running against an older schema.
- Restored player sessions now resolve incomplete track metadata live, so opaque provider IDs no
  longer remain in the title, artist, album, or release-year display.
- On narrow Listening Room layouts, the bottom navigation now occupies the shell's reserved footer
  row instead of covering the docked player and attribution footer.
- TIDAL playlist imports now request nested track artist and album relationships, avoiding the
  provider's `GENERIC_REQUEST_ERROR` response for playlists larger than its first page.
- Owner-scoped TIDAL, playback, taste, Last.fm, and listening-shell paths now reject signed-in
  non-owner accounts; failure, sync, and log paths no longer expose raw upstream details.
- Mobile Now Playing clears an unfinished seek preview when the track changes, preventing a stale
  position from appearing on the next track.
- TIDAL Device Authorization stops polling and presents a localised retry state when its request
  fails or expires.
- Playlist import now uses TIDAL's authenticated v2 collection, follows complete item pagination,
  preserves source order and duplicates, and defers stream checks instead of rewriting playlists.
- TIDAL playlist import failures and malformed import requests now return recoverable in-app results
  instead of exposing a raw HTTP 400 response.
- TIDAL assets reported as unavailable for playback are no longer presented as a broken Link authorization, and imports now seek a playable replacement instead of retaining the known-bad item.
- Deleted playlists can no longer be resurrected from a stale browser cache during background sync; the database-owned playlist snapshot is now authoritative.
- Playlist imports, reads, synchronization, and mutations now require the owner account.
- A queue conflict that needs another review can now refresh the authoritative queue, replay local queue edits, and save without interrupting the current audio.
- Playback-state conflicts now rebase deliberate queue edits onto the accepted queue and retry once without interrupting local audio.
- Mobile search can retry failed queries, recover from expired sign-in or a disconnected TIDAL account, and end stalled requests. Radio can be cancelled and late responses no longer replace a newer track or start playback after leaving search.
- Mobile search now keeps its query in the URL and restores it with browser history navigation.
- Search API access now requires the owner account and connection lookup failures return a safe error.
- Mobile search queue controls have 48-pixel touch targets and keep long track titles on their own row.

### Changed

- Halflight now uses one sleek dark interface system. Palette and art-direction controls, their client persistence, and their settings route were removed so music, artwork, and playback state lead the visual hierarchy.

## [0.0.1] - 2026-09-02

### Added

- Initial release of Syn music application with TIDAL integration.
- Responsive app shell with side navigation, mobile navigation, mini player, and queue drawer.
- Global 10-pixel footer with version number, copyright notice, and legal attribution.
- Full song native playback engine translating core streaming manifest parser and TIDAL API resolution from `oskvr37/tiddl`.
- TIDAL Device Authorization flow (`https://link.tidal.com`) with `r_usr` streaming playback scopes.
- High-fidelity stream metadata and telemetry badges (`FLAC LOSSLESS`, `AAC 320k`) in the audio player.
- Real-time synchronized lyrics engine (`parseLrc`) with karaoke-style line tracking, auto-scrolling, and interactive seeking in the player and track view.
- Official editorial album reviews and critiques with legacy WiMP link sanitization on album pages.
- Standard Extended M3U8 playlist exporter (`#EXTM3U` format) for custom playlists, TIDAL playlists, albums, and tracks.
- Loudness normalization (ReplayGain telemetry) integration in the audio engine.
- Direct Server-Side Audio Streaming Proxy (`/api/tracks/[id]/audio`) with HTTP Range support to bypass TIDAL CDN CORS restrictions on HTML5 `<audio>`.
- Graceful preview fallback (`previewUrl`) in the streaming endpoint with clear UI prompts for Device Authorization.
- Two-way TIDAL playlist synchronization engine (`/api/playlists/sync`, `/api/playlists/import`) with change detection (`diffPlaylistItems`), pull/push, and batch operations.
- TIDAL write operations in `api.ts`: `updatePlaylist`, `deletePlaylistRemote`, `removePlaylistItems`, `replacePlaylistItems` with automatic 50-track chunking and `playlists.write` OAuth scope detection.
- Database schema migration for `user_playlist` with sync tracking columns (`source`, `sync_status`, `last_synced_at`, `remote_etag`, `sync_error`).
- Interactive Playlist Import Modal (`PlaylistImportModal.svelte`) to selectively import remote TIDAL playlists.
- Unified playlist page with dual-resolution (local vs remote), inline title/description editing, sync status pills, and deletion confirmation with TIDAL remote cleanup option.
