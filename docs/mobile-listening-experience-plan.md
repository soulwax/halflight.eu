# Halflight Now: a serious mobile player

Written 2026-10-06. Status: proposed, not implemented.

This plan builds on, and does not repeat, [mobile player controls](mobile-player-ux-plan.md),
[navigation and listening recovery](navigation-recovery-plan.md) and
[overall UX/UI](overall-ux-ui-plan.md). Those documents delivered the controls, the recovery
states and the entry routing. This one is about the step after that: making Halflight Now feel
like a dependable, well-rounded music app on any current phone, with Spotify as the
**interaction** reference.

## Ground rule: the look stays, the behaviour changes

Halflight keeps its visual identity. Concretely:

- The four theme presets (`dark`, `light`, `warm-night`, `electric`) and every semantic token in
  `src/routes/layout.css` stay as they are: colour, radius, shadow, motion timing and heading
  typography. No new palette, no Spotify green, no Spotify typography.
- New motion uses the existing `--dur-*` / `--ease-out` tokens, so every new animation inherits
  each theme's character for free (Warm Night stays unhurried, Electric stays snappy).
- New surfaces (sheet, snackbar, sticky detail header) are built from existing surfaces
  (`--surface-raised`, `--surface-selected`, `--border-subtle`, `--action`) and primitives
  (`Notice`, `Button`, the action sheet), and must look native in all four themes.

"Spotify-like" here means the **interaction model**:

- The player is a sheet that lives above whatever you were doing, not a page you navigate to.
- Each tab remembers where you were.
- Back is instant, and taps respond immediately.
- Gestures are consistent, and everything has a long-press/overflow path.
- The app never makes you lose your place.

## What the code does today (verified 2026-10-06)

These are the gaps this plan targets. Each was confirmed by reading the source, not inferred
from screenshots.

| #   | Finding                                                                                                                                                                                                                                                         | Where                                                                 | Effect                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Now Playing is a **route** (`/now`, `/now/queue`, `/now/lyrics`, `/now/credits`). Closing it navigates to `returnTo`, which remounts the previous screen and re-runs its server load (TIDAL calls included).                                                    | `(mobile)/+layout.svelte`, `NowPlayingScreen.svelte`, `navigation.ts` | Closing the player costs a network round-trip. Unsubmitted input and in-memory component state below are lost.                   |
| 2   | Every mobile `+page.server.ts` **awaits** all TIDAL calls before returning (artist: four requests in two waves).                                                                                                                                                | `(mobile)/{home,albums,artists,playlists,tracks}/…/+page.server.ts`   | A tap does nothing visible until the slowest request finishes, then the whole screen jumps in. No skeletons, no partial content. |
| 3   | Revisiting a screen (Back, tab switch) re-runs its server load; nothing is cached client-side.                                                                                                                                                                  | SvelteKit default with server-only loads                              | Back is never instant. Spotify's Back is.                                                                                        |
| 4   | `onNavigate` wraps **every** navigation, including tab switches and `popstate`, in one whole-root view transition. Header, mini player and tab bar crossfade with the content. On iOS, a native edge-swipe Back is followed by a second, app-driven transition. | `(mobile)/+layout.svelte`                                             | Persistent chrome flickers on every move; iOS swipe-back double-animates.                                                        |
| 5   | The tab bar highlights from the URL path only. Shared detail routes (`/albums/[id]` etc.) highlight no tab, and there is no per-tab memory or re-tap behaviour.                                                                                                 | `NowTabBar.svelte`                                                    | You lose your place switching tabs; the bar can't tell you where you are in a detail.                                            |
| 6   | No `(mobile)/+error.svelte`. A failed mobile load renders the root error page **outside** the mobile layout. Audio continues (the engine is a module singleton), but the mini player, tabs and recovery strip disappear.                                        | `src/routes/+error.svelte` only                                       | One upstream error strands the listener on a page with no player controls.                                                       |
| 7   | The mini player mounts only after `restorePlaybackState` runs in a client `$effect`, although the server already knows the current track (`data.playbackState`).                                                                                                | `(mobile)/+layout.svelte`, `MiniPlayer.svelte`                        | On cold load the content region shrinks by ~60px after hydration. A visible layout shift on every open.                          |
| 8   | The search input uses `font: inherit` from `body` (`--fs-base`, 14px).                                                                                                                                                                                          | `MobileSearch.svelte`, `layout.css`                                   | iOS Safari zooms the page on focus for inputs under 16px. Search, the main mobile task, zooms in every time.                     |
| 9   | 52 `:hover` rules across mobile/music/player components; none is guarded by `@media (hover: hover)`.                                                                                                                                                            | `components/{mobile,music,player}`                                    | Sticky hover states after a tap on touch devices.                                                                                |
| 10  | Now Playing mixes `vh`, `vw` and `dvh` (`clamp(…, 0.8vh, …)`, `clamp(1.25rem, 4.6vw, 1.6rem)`, `max-height: 100dvh`, `55dvh`). In iOS Safari `vh` is the _large_ viewport.                                                                                      | `NowPlayingScreen.svelte` styles                                      | Spacing and sizes depend on browser chrome state rather than the space the player actually has. `vw` type ignores text zoom.     |
| 11  | Header and tab bar pad only `safe-area-inset-top` / `-bottom`; no left/right insets.                                                                                                                                                                            | `(mobile)/+layout.svelte`, `NowTabBar.svelte`                         | In landscape on Dynamic Island / notch iPhones, the first and last tabs and the menu button sit under the cutout.                |
| 12  | The mini player requests 80px artwork for a 40px box.                                                                                                                                                                                                           | `MiniPlayer.svelte`                                                   | Soft artwork on every DPR 3 / 3.5 phone (all current iPhones, Pixel Pro, Galaxy S).                                              |
| 13  | `bragi-audio`'s Media Session registers `seekbackward`/`seekforward` alongside `previoustrack`/`nexttrack`. On iOS, seek handlers take precedence and show ±10s skip buttons instead of track buttons (known WebKit behaviour; confirm on device).              | `node_modules/bragi-audio/dist/player/media-session.js`               | Lock screen and Control Centre look like a podcast player, not a music player.                                                   |
| 14  | `chooseSite` sends viewports wider than 768px to the desktop site.                                                                                                                                                                                              | `src/lib/mobile/site-entry.ts`                                        | Galaxy Z Fold inner screens (928–984px) get the Listening Room; unfolding mid-session can't switch without a reload.             |
| 15  | Layout tests run only in Chromium at hand-picked sizes. The only Playwright e2e covers `/sign-in`. No WebKit, no device profiles, no mobile routes.                                                                                                             | `vite.config.ts`, `playwright.config.ts`                              | iOS-specific breakage (the main target) is invisible to CI.                                                                      |

Delivered and solid, so this plan reuses rather than rebuilds them:

- the shared player singleton and its queue identity, reconciliation and recovery states
- the artwork swipe/pull gestures (`gestures.ts`)
- per-route scroll restoration and detail return targets
- view-transition shared artwork
- the action sheet
- haptics, theme handling and the 48px control sizing

## Workstreams

### A. The player becomes a sheet

This is the single biggest change toward the Spotify feel, and it fixes findings 1 and 4 for the
player.

- **One `NowPlayingSheet` mounted in `(mobile)/+layout.svelte`**, above `<main>` and outside route
  content. It wraps today's `NowPlayingScreen` contents. The screen underneath stays mounted:
  its scroll, search input, filters, loaded data and in-flight requests survive opening and
  closing the player.
- **Open/close via SvelteKit shallow routing.** The mini player calls
  `pushState(href('/now'), { nowPlaying: 'player' })`. `page.state.nowPlaying` drives the sheet.
  - Hardware/browser Back and swipe-back close it, because it is a real history entry.
  - Close calls `history.back()` when the current entry is ours, otherwise
    `replaceState(…, {})`.
  - The URL reads `/now` while open, so a share or reload still lands correctly.
- **Queue, Lyrics and Credits become views inside the sheet**:
  - `page.state.nowPlaying` is `'queue' | 'lyrics' | 'credits'`, also via `pushState`.
  - Spotify-style, the player view scrolls down into a lyrics card, an "About the artist"
    card, a credits card and an "Up next" preview. Each card expands into its full view.
  - The existing routes stay as deep-link entry points: a direct load of `/now/queue` renders
    Home beneath with the sheet open on Queue, and closing it uses `replaceState` to `/home`.
    `navigation.ts` keeps owning these rules (pure, already tested).
- **Motion** uses CSS transforms, not a navigation transition: `translateY(100%) → 0` on
  `--dur-slow` / `--ease-out`. The existing `syn-now-art` shared-element name stays for the
  artwork morph where View Transitions exist.
  - The existing pull-to-close gesture drives the same transform, and dismissal follows the
    finger's velocity.
  - Swipe **up** on the mini player opens the sheet (new; reuses `lockDragAxis` / `dampDrag`).
- **Accessibility**: while open, the sheet is `role="dialog"`, `aria-modal="true"`, labelled by
  its visible "Now playing" context. The shell underneath gets `inert`.
  - Focus moves to Close on open and returns to the mini-player identity link on close.
  - Escape closes the sheet.
  - Reduced motion: instant open/close, no artwork morph.
- **Performance**: the sheet stays mounted after its first open and is hidden with
  `visibility` + `inert`, not unmounted. Reopening is instant, and the ambient blur isn't
  rebuilt every time. While it's closed, it pauses lyric following and marquee animations.

**Decided 2026-10-06: three tabs.** The tab bar is **Home, Search, Library**; the mini player is
the only way into the player, as in Spotify. This supersedes the four-tab composition in the
[navigation and listening recovery plan](navigation-recovery-plan.md).

- Home owns the empty-session invitation that the Now tab was carrying. With an empty session
  the mini-player slot shows a slim "Start listening" line rather than nothing, so the shell's
  reserved rows never collapse.
- Removing the fourth tab frees about 25% more width per tab, which is what makes the German
  labels fit at 320px without wrapping.
- `/now` and its sub-routes stay as deep links and keep their `MOBILE_ROOT_PATHS` entries; they
  simply stop being a tab destination. The Now tab's `aria-current` handling disappears with it.
- Migration detail: an existing history entry or bookmark pointing at the Now tab still works,
  because it is the same URL that now opens the sheet.

### B. Navigation that never loses your place

Fixes findings 4 and 5.

- **Per-tab stacks.** The layout keeps `lastLocation[tab]` (path + search + scroll key).
  - Each history entry records its owning tab in `page.state.tab`. A detail opened from
    Search belongs to Search, and the bar highlights Search.
  - Fallback for entries without state (a direct load): derive the tab from the
    `detailReturnTargets` chain, else Home.
- **Tab taps, Spotify semantics:**
  - Inactive tab → its last location, scroll restored.
  - Active tab while deeper than its root → its root.
  - Active tab at root → scroll to top (smooth unless reduced motion).
  - Search tab at root → focus the search field.
- **Back in sub-headers** uses `history.back()` when the previous entry is in-app (tracked via
  an index in `page.state`), otherwise the remembered parent route. This keeps `Back` in the
  header and the system Back identical.
- **Transitions with persistent chrome.**
  - Give the header, recovery strip, mini player and tab bar their own `view-transition-name`
    so they stay perfectly still, and only `root` content animates.
  - Push: content slides from inline-end (RTL-aware via `dir`). Pop: the reverse. Tab switch:
    a short crossfade (`--dur-fast`) or none.
  - **Never animate `popstate` that started as an iOS edge swipe.** WebKit already animated
    it. Detect a `touchstart` within ~24px of the left/right edge followed by `popstate`, and
    skip the transition. When in doubt on WebKit touch devices, skip popstate animation
    entirely.
  - All durations from theme tokens; reduced motion means no transitions (as today).
- **Snapshots.** Pages with transient UI state (search query and chip filter, library
  section/sort, expanded sections) export SvelteKit `snapshot`. That state then survives Back,
  reload and bfcache, not only in-session navigation.

### C. Perceived speed: every tap answers within 100ms

Fixes findings 2, 3, 7 and 12.

- **Stream non-critical data.** Server loads return the identity first and hand slower parts
  back as un-awaited promises. SvelteKit streams them, and `{#await}` blocks render skeletons
  (blocks, not async-mode `await` expressions; see CLAUDE.md on async mode under vitest).
  - Artist: header first; top tracks, albums and radio streamed.
  - Album/playlist: header first; items streamed.
  - Home: shell first; daily mix streamed.
  - Navigation commits on the first chunk, so the screen changes immediately.
- **Seeded heroes.** A card or row already holds the title, artist and artwork the next screen
  needs. On tap it writes its summary to a small client seed map keyed by `href`, and the
  detail page renders its hero from the seed until the streamed data arrives. No blank
  header, no artwork pop-in.
- **Instant Back.** Move mobile detail fetching to universal `+page.ts` loads calling JSON
  endpoints, reusing existing `/api` routes where they exist.
  - Responses send `Cache-Control: private, max-age=120, stale-while-revalidate=600`. Back and
    tab returns come from the browser HTTP cache with no server round-trip.
  - Payloads are normalised view models only (no tokens, no signed URLs). The `private`
    directive keeps shared caches out.
  - Auth gating stays inline in each endpoint, as everywhere else.
- **Preload policy.** On touch, `preload-data` fires on `touchstart`, so a scroll through a long
  track list would preload every row and burn TIDAL rate limit.
  - Set `data-sveltekit-preload-code="viewport"` on the mobile shell.
  - Keep `preload-data` only on hero cards and tiles; turn it off on long lists.
- **Catalogue read memo (accepted 2026-10-06).** A new `#lib/server/tidal/catalogue-cache.ts`
  memoises normalised catalogue reads so repeated preloads, Back navigations and two sites
  looking at the same album cost one upstream request.
  - **Shape**: L1 process map only, in the spirit of `stream-cache.ts`'s first tier —
    bounded LRU (start at 300 entries), 60s TTL, single-flight per key so a burst of
    preloads collapses into one TIDAL call. Fail-open: a memo error falls through to a live
    read.
  - **Deliberately not Redis.** A 60-second process map is a cache; a Redis entry is closer
    to stored catalogue text, which is what CLAUDE.md's "no catalogue text" rule exists to
    prevent. Cross-process sharing would be a separate decision, and the single PM2 fork
    process does not need it.
  - **Only provider catalogue reads.** Keys are the resource and its include set
    (`album:123:artists,items`), never anything user-scoped. `filterPlayableTracks`,
    `getUserPlaylists`, playback state and settings stay outside the memo and keep running
    per request — the repo is multi-listener now (`locals.isListener`), so a cached value
    that embedded one listener's data would leak across accounts. The memo therefore sits
    **below** normalisation and **above** nothing user-specific: cache the normalised
    `AlbumSummary`, then filter playability per request.
  - Stores view models from `normalise.ts` only: no raw JSON:API documents, no tokens, no
    signed CDN URLs (those belong to `stream-cache.ts`, which seals them).
  - Tested with an injected clock and a fake upstream, like the other server modules: TTL
    expiry, LRU eviction, single-flight coalescing, and a key-collision test proving include
    sets and ids cannot alias.
- **Pending feedback.**
  - Pressed states on every tappable item (`:active` scale/opacity on `--dur-fast`).
  - A thin top progress line shown only if `navigating` lasts more than 150ms, to avoid
    flicker on fast loads.
- **Server-render the mini player** from `data.playbackState.currentTrack`, so its row exists at
  first paint and hydration doesn't shift content. The live player takes over without
  changing geometry.
- **Artwork resolution.** Size requests by rendered box × DPR, using `srcset` across the
  available artwork sizes (mini player 40px → 160 at DPR 3; rows; heroes; the Now artwork
  box).
  - Always set `width`/`height` or `aspect-ratio` so nothing reflows.
  - Lazy-load and async-decode artwork below the fold.
- **Budgets** (measured in Playwright with 4× CPU throttle on the Galaxy A55 and Pixel 8
  profiles):
  - INP under 200ms
  - visual response to a tap under 100ms
  - cached tab switch / Back under 150ms
  - first detail content under 400ms after commit on a warm server
  - sheet open/close and drags at 60fps with no long tasks over 50ms

### D. Spotify-grade interaction details

All in existing tokens and primitives. Each gesture below also has a visible, labelled control
(WCAG 2.5.1 / 2.5.7).

| Surface      | Behaviour to add                                                                                                                                                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mini player  | Horizontal swipe on the identity skips (with neighbour peek, reusing the Now artwork logic); swipe up opens the sheet; long-press opens the track action sheet; a "Playing on …" line replaces the artist when another device holds playback.                                                                                                   |
| Now Playing  | Scrollable below the transport into lyrics / artist / credits / up-next cards (A); save/add-to-playlist beside the title (exists); sleep timer, go to album/artist and track details in the More menu; quality and location stay one concise status line.                                                                                       |
| Track rows   | The currently playing row shows the title in `--action` plus a small equaliser glyph (static under reduced motion). Swipe right adds to queue with a haptic tick and snackbar; long-press and ⋯ both open the action sheet; tap still plays in context.                                                                                         |
| Action sheet | Header with artwork, title and artist; drag handle and swipe-down dismiss; Spotify ordering: Add to playlist · Add to queue · Play next · Go to album · Go to artist · Radio · Credits · Copy link. Focus trap and restore (exists).                                                                                                            |
| Snackbar     | One transient message slot above the mini player, so a queue add, save or remove confirms without moving layout. Optional Undo for remove/clear/replace. Announced politely; one at a time; never during a drag. Built on `Notice`'s tones, not a new visual language.                                                                          |
| Detail pages | Hero (artwork, title, owner/artist, meta) scrolls away into a sticky compact header whose title fades in. A Play button (with Shuffle) docks into the sticky header as the hero leaves. Scroll-driven CSS (`animation-timeline: scroll()`) where supported, an `IntersectionObserver` sentinel otherwise; static under reduced motion.          |
| Home         | Resume card when eligible (exists). A two-column grid of 6–8 quick tiles from recent history, deduped by album/playlist. Mixes rail (exists) and generated sets. One composition for empty, restoring and failed sessions.                                                                                                                      |
| Search       | Empty state shows recent searches (device-local `localStorage`, clearable, never synced). A top-result card, then filter chips (Songs, Artists, Albums, Playlists) that keep their scroll. Enter dismisses the keyboard; tapping results dismisses it. Mini player and tab bar hide while the keyboard is up (Spotify does) and return on blur. |
| Library      | Filter chips and a sort control remembered per device; list/grid toggle; helpful empty states (exists, keep).                                                                                                                                                                                                                                   |
| Queue        | "Now playing", then "Up next" over the one existing queue. Drag handle with long-press reorder; swipe-left remove with Undo; move up/down buttons stay as the non-drag path (exists).                                                                                                                                                           |

**Declined 2026-10-06: separate user queue vs context.** Spotify keeps tracks you queued ("Next
in queue") distinct from the album or playlist you started, so Play next and Add to queue jump
ahead of the context without destroying it. Halflight keeps **one queue**, and this plan does not
change that: it would touch `bragi-audio`'s queue identity, the `playback_state` schema, the
intent set and reconciliation, and need a migration — for a distinction that mainly matters when
several people queue into one session.

Consequences to honour in the UI work above, so nothing promises a split that does not exist:

- The queue view uses one "Up next" heading. No "added by you" grouping, no separate section
  that would have to be faked.
- Play next inserts at position 0 and Add to queue appends, both to the same list, and the
  snackbar says exactly that ("Playing next", "Added to queue").
- Starting an album or playlist replaces the queue, which is the existing behaviour and already
  behind a confirmation for a non-empty queue. Keep that confirmation: with one list it is the
  only thing standing between a tap and a lost queue.

### E. A serious audio player

Fixes finding 13 and hardens the parts only a real phone exercises.

- **Lock screen and Control Centre.**
  - Do not register `seekbackward`/`seekforward` on iOS for music; keep `previoustrack`,
    `nexttrack` and `seekto`. The fix belongs in `bragi-audio`'s `media-session` (a
    `mode: 'music' | 'spoken'` option), released and re-pinned as CLAUDE.md describes.
  - Supply the artwork array at 96/192/256/512, and include the album name.
  - Call `setPositionState` on track change, seek, pause and resume (not on every tick).
- **Audio session.** Where `navigator.audioSession` exists (Safari 16.4+), set
  `type = 'playback'` before the first `play()`. Feature-detected, no-op elsewhere.
- **Interruptions.** Calls, Siri and other apps' audio pause the element. Reflect the observed
  `pause` and do not auto-resume; resume only on a user or OS `play` command. After
  `offline → online`, retry a stalled track once from its position.
- **Buffering.** Show buffering only after `waiting` persists for about 500ms, so seeks and
  segment boundaries don't flash a spinner. Clear it on `playing`.
- **Background advance.** With the screen locked, the next track must start from the `ended`
  handler on the same element without a new user gesture. Verify on iOS Safari and in the
  installed PWA with `StreamPreloader`. The documented test is ten consecutive track changes
  while locked. Record any WebKit limitation in this document rather than papering over it.
- **bfcache and tab discard.**
  - On `pageshow` with `persisted`, refresh the session revision and re-assert Media
    Session. Ensure nothing registers `unload` (which disables bfcache).
  - Android discards background tabs; the server snapshot restore already covers it. Verify
    that the position flush on `visibilitychange: hidden` lands before discard.
- **Sleep timer.** Choices: end of track, 15, 30, 45 or 60 minutes, client-only and visible in
  the sheet.
  - iOS ignores `audio.volume`, so no fade there: pause at the boundary.
  - Fade where volume is writable.
- **Deliberately out of scope:**
  - crossfade
  - gapless DASH joins
  - downloads/offline audio
  - a volume slider (iOS can't honour one)
  - output selection

### F. Accessibility (WCAG 2.2 AA, on phones)

- **Sheet**: dialog semantics, `inert` background and focus in/out (A). One `h1` per screen;
  landmarks `header` / `nav` / `main` stay stable across navigation.
- **Announcements**: a single polite live region announces "Now playing _title_ by _artist_" on
  user-initiated changes only (debounced; never per tick and never on restore). Snackbar
  messages share the same region.
- **Seek slider**: `aria-valuetext` like "1:24 of 9:02". Arrow keys move 5s, Page Up/Down 30s.
  Disabled with a reason when the duration is unknown or another device holds playback
  (existing rules).
- **Gestures**: every swipe, long-press and drag has a labelled control. Long-press must not
  conflict with VoiceOver/TalkBack actions. Expose secondary track actions through the ⋯
  button, which assistive tech reaches anyway.
- **Text**:
  - test OS large text at 130% and 200%, with the existing `meta name="text-scale"`
  - add `-webkit-text-size-adjust: 100%` so landscape iOS doesn't inflate text
  - no `vw`-based font sizes (finding 10)
  - 320px reflow without horizontal scroll
- **Contrast over artwork**: the ambient artwork wash behind Now Playing gets a theme-token
  scrim, so text contrast holds for any cover (a white cover in `light`, a neon cover in
  `electric`). Verify with axe plus a bright and a dark fixture cover per theme.
- **Touch**: 48px targets for transport, at least 44px elsewhere. `touch-action: manipulation`
  on the shell; `-webkit-touch-callout: none` on artwork so long-press isn't hijacked by "Save
  image". Guard every hover style with `@media (hover: hover)` (finding 9).
- **Motion and transparency**: reduced motion disables the sheet slide, transitions, the
  marquee and the equaliser glyph. Reduced transparency drops the backdrop blur (partly done).
- **Orientation**: never locked (1.3.4); landscape gets the existing two-column Now layout.

### G. Precise CSS on every current phone

"Precise no matter what" does not mean a media query per model; that approach breaks with the
next release. It means a small set of fluid rules driven by the space actually available,
**verified against a device matrix in CI**.

**Layout rules.**

1. **One viewport unit, used once.** The shell keeps `height: 100dvh` as a fixed frame (the
   document never scrolls; `<main>` does), and the `100lvh` standalone special case is
   dropped unless a device test proves it necessary.
   - Inside the shell, mobile components use no `vh`/`vw`/`dvh` at all (finding 10).
   - `.now-screen` and other full-height scenes declare `container-type: size` and size
     themselves in `cqw`/`cqh`. Artwork becomes
     `min(100cqw − 2·gutter, 100cqh − controls-block)` with `aspect-ratio: 1`. It is then
     exact on every phone, in split-screen, and on a foldable, whatever the browser chrome
     is doing.
2. **Container buckets, not device buckets.**
   - Height: compact < 600px (SE, landscape, Flip covers), regular 600–760, tall > 760.
   - Width: < 360 (reflow floor), 360–399, 400–439, ≥ 440, and ≥ 600 (foldable inner →
     two-pane Now and detail).
   - Written as `@container` queries on the scene, so the sheet, a split-screen window and a
     full screen all behave correctly.
3. **Safe-area tokens.** Define `--safe-top/right/bottom/left: env(safe-area-inset-*, 0px)`
   once in `layout.css`, beside the theme-independent tokens.
   - Every component uses the tokens, and each edge's inset is applied exactly once. Header,
     tab bar, mini player and sheets also take left/right insets (finding 11):
     `padding-inline: max(var(--gutter), var(--safe-left))` and so on.
   - The tokens are also the test seam (see the device matrix below).
4. **Keyboard.**
   - Add `interactive-widget=resizes-content` to the viewport meta; Chrome Android honours
     it and others ignore it.
   - On iOS, a `visualViewport` listener sets `--keyboard-inset`.
   - While a text field is focused, Search hides the mini player and tab bar and pins results
     above the keyboard.
   - Inputs are at least 16px (finding 8; set `font-size: max(1rem, …)` on mobile form
     controls).
5. **Pixel density**: `srcset` per C. Hairline borders stay `1px`; no `0.5px` tricks, which
   render unevenly at fractional DPRs (2.25, 2.625, 3.5).
6. **Foldables**: raise or replace the 768px site-entry cutoff (finding 14) so Fold inner
   screens get Halflight Now.
   - The ≥ 600px container bucket gives them a two-pane Now (artwork | controls and lyrics)
     and a wider detail column with a max line length.
   - Folding or unfolding must not remount the player (an existing navigation-recovery rule).

**Device matrix.** Current phones from roughly the last three years plus the floors. Values are
Playwright 1.60's bundled descriptors (installed in this repo): CSS viewport with browser chrome
visible, then full screen and DPR. Rows marked _verify_ need one measurement from the
diagnostics panel below before they are trusted.

| Bucket              | Profiles                                                                  | Viewport (CSS px)         | Screen              | DPR   | Engine   | Insets to emulate (portrait)                     |
| ------------------- | ------------------------------------------------------------------------- | ------------------------- | ------------------- | ----- | -------- | ------------------------------------------------ |
| Reflow floor        | iPhone SE (1st gen) profile                                               | 320×568                   | —                   | 2     | WebKit   | none                                             |
| Home-button iPhone  | iPhone SE (3rd gen), sold until 2025                                      | 375×667                   | —                   | 2     | WebKit   | none                                             |
| 360 Android         | Galaxy S24 · Pixel 9 / 10 · Z Flip 6 / 7 · Z Fold 7 cover                 | 360×780 / 732 / 804 / 764 | 360×808–880         | 3     | Chromium | top status bar, bottom gesture bar (_verify_)    |
| Notch iPhone        | iPhone 16e · 17e                                                          | 390×651                   | 390×844             | 3     | WebKit   | top 47, bottom 34 (_verify_)                     |
| Dynamic Island 6.1″ | iPhone 15 · 15 Pro · 16                                                   | 393×659                   | 393×852             | 3     | WebKit   | top 59, bottom 34                                |
| Dynamic Island 6.3″ | iPhone 16 Pro · 17 · 17 Pro                                               | 402×681                   | 402×874             | 3     | WebKit   | top 62, bottom 34 (_verify_)                     |
| 412 Android         | Pixel 8 · 8a                                                              | 412×839                   | 412×915             | 2.625 | Chromium | _verify_                                         |
| iPhone Air          | no bundled profile: custom                                                | 420×~730 (_verify_)       | 420×912             | 3     | WebKit   | _verify_                                         |
| 427 Android         | Pixel 9 Pro · 10 Pro                                                      | 427×876                   | 427×952             | 3     | Chromium | _verify_                                         |
| Large iPhone        | iPhone 15 / 16 Plus · 15 Pro Max                                          | 430×739                   | 430×932             | 3     | WebKit   | top 59, bottom 34                                |
| Largest iPhone      | iPhone 16 Pro Max · 17 Pro Max                                            | 440×763                   | 440×956             | 3     | WebKit   | top 62, bottom 34 (_verify_)                     |
| Large Android       | Pixel 8 Pro · 9 Pro XL · 10 Pro XL                                        | 448×921                   | 448×997             | 3     | Chromium | _verify_                                         |
| Mid-range Android   | Galaxy A55 (high-volume class; also the CPU-throttled perf profile)       | 480×1040 (_verify_)       | —                   | 2.25  | Chromium | _verify_                                         |
| Foldable cover      | Galaxy Z Fold 6 cover                                                     | 484×1112                  | 484×1188            | 2     | Chromium | _verify_                                         |
| Foldable inner      | Galaxy Z Fold 6 · Fold 7                                                  | 928×1004 · 984×1016       | 928×1080 · 984×1092 | 2     | Chromium | _verify_                                         |
| Landscape           | `… landscape` profiles of iPhone 15, 16e, 17 Pro Max, Pixel 8, Galaxy S24 | e.g. ~852×~360            | —                   | —     | both     | Dynamic Island: left/right 59, bottom 21         |
| Best effort only    | Galaxy Z Flip 6 / 7 cover (360×298 / 474×448)                             | —                         | —                   | —     | Chromium | no overflow; Now shows identity + transport only |

iPhones released after this table (the 2026 generation) are added when Playwright gains their
profiles or a diagnostics measurement exists. No measurement is copied from an unverified spec
sheet.

**Emulation is not enough.** Playwright/Chromium/WebKit emulation reports `env(safe-area-inset-*)`
as `0` and has no collapsing Safari toolbar. So:

- Layout tests override the `--safe-*` tokens with each profile's insets above. That is why
  the tokens exist.
- Tests run both the "toolbar visible" viewport height and the full screen height.
- A **Display diagnostics** panel (owner-only, Settings → Advanced) shows and copies as JSON:
  - `innerWidth`/`innerHeight`, `visualViewport`, `screen` and DPR
  - computed safe-area insets (read from a probe element padded with `env()`)
  - `display-mode`, the `prefers-*` flags and the rendering engine

  One paste from each real phone turns a _verify_ row into a measured one; record it in this
  table with the date.

### H. Stability between screens and over a long session

- **Mobile error boundary.** Add `(mobile)/+error.svelte`, rendered inside the mobile layout so
  the header, mini player, tabs and recovery strip survive (finding 6).
  - It distinguishes not-found from upstream failure, reusing `MobileDetailRetry`.
  - It offers Retry (`invalidate`) and Back.
- **Deploys must not break open tabs.** `pnpm pm2:reload` replaces `build/`. A tab still
  running the old client that navigates to a route whose chunk it never loaded requests a
  deleted file. SvelteKit then falls back to a full page load, which **stops audio**.
  - Mitigation, in order of preference:
    1. Confirm that `buildPrecacheAssets` keeps **every** `_app/immutable` JS/CSS chunk
       within the precache budget. The old service worker, which never `skipWaiting`s,
       keeps serving the old chunks to the old tab.
    2. Otherwise, retain the previous build's `immutable/` directory alongside the new one
       for a grace period.
  - Use `version.pollInterval` plus `updated` to show a quiet "Update ready" snackbar that
    reloads only when the owner taps it, or automatically on the next navigation while
    nothing is playing.
- **No hydration shifts**: server-rendered mini player (C); skeletons with final geometry;
  artwork with intrinsic size; recovery strip height animated only by transform/opacity.
- **Command storms.** Add a `fast-check` property suite over random sequences of
  next/previous/seek/toggle/swipe/queue-edit with simulated slow stream resolution. It asserts:
  - at most one track loading
  - `isLoading` never sticks
  - the queue's entry IDs are never duplicated or lost
  - the UI's derived availability (`canGoNext` and similar) matches what the command would do
- **Long sessions**: every component that adds observers/listeners (`ResizeObserver` for the
  title, `matchMedia`, gestures) cleans up; verified by a 200-navigation Playwright loop
  checking listener and DOM-node counts stay flat. Long lists use
  `content-visibility: auto` with a size hint rather than virtualisation.
- **Real-world network**: a Playwright suite under offline/slow-3G toggles mid-navigation and
  mid-playback asserts the screen stays usable, recovery appears, and nothing is erased.

### I. Testing and acceptance

- **Device-matrix layout specs (vitest browser).**
  - Add a `mobile-webkit` project: WebKit, `maxWorkers: 1`, so the existing Chromium pools
    aren't starved. It runs `src/lib/components/mobile/**/*.layout.svelte.spec.ts`. The
    existing Chromium client project runs the same files.
  - A static `src/lib/mobile/testing/device-matrix.ts` holds the table above (viewport, screen,
    DPR, insets). Browser tests can't import `playwright`, so the table is generated once from
    its descriptors and checked in.
  - Assertions per profile:
    - no horizontal overflow
    - transport and Close within the viewport and at least 48px
    - last list row not covered by the mini player or tab bar
    - Now artwork square and fully visible
    - the sheet's Close reachable with the toolbar-visible height
  - Rather than the full product, cover profile × theme (4) × locale (en, de-DE) × text scale
    (1, 1.3, 2) pairwise.
- **Playwright e2e on mobile profiles.** Add `projects` for iPhone 15, iPhone SE (3rd gen),
  iPhone 17 Pro Max landscape, Pixel 8, Galaxy S24 and Galaxy Z Fold 7, with `webkit`
  installed alongside Chromium in `test:e2e`. Journeys:
  1. cold open → Resume → open the sheet → seek → Queue → reorder → close → the same scroll
     position
  2. search → album → artist → Back twice → query and scroll intact
  3. tab-stack and re-tap behaviour
  4. a failed detail load keeps the player
  5. keyboard open on Search keeps results visible
  6. axe on every mobile route in all four themes
- **Deterministic e2e data (needed, in a smaller form than first proposed).** The owner deferred
  a fixture adapter unless the plan actually needs one. It does: mobile routes need a signed-in
  listener **and** a connected TIDAL account, and the data arrives through `+layout.server.ts`
  and `+page.server.ts`, where Playwright's `page.route` cannot reach it. The TIDAL hosts are
  module constants (`config.ts`'s `TIDAL_API_BASE` / `TIDAL_TOKEN_URL`, and the `api.tidal.com`
  literals in `api.ts`, `stream.ts`, `lyrics.ts` and friends), so today a test either talks to
  the real TIDAL from CI — slow, flaky, third-party, rate-limited — or runs with no connection
  and tests the "connect TIDAL" state instead of the product.

  Smaller replacement for the fixture adapter: **one dev-only base-URL override**, not a second
  adapter implementation.

  - Collect the hardcoded hosts into `config.ts` and let them read one optional env var
    (`TIDAL_API_ORIGIN_OVERRIDE`, declared in `src/env.ts` with a `.env.example` placeholder).
  - Two guards, both enforced server-side at module load: it is ignored unless `dev`, **and**
    ignored unless its host is loopback. A production build therefore cannot be pointed at
    another origin even if the variable leaks into its environment, and the guard is one small
    testable function.
  - A loopback fixture server (started by Playwright's `webServer` alongside the app) serves
    the JSON:API documents, the token endpoint, the playback-info manifest and a short
    generated tone for the media bytes.
  - This is higher-fidelity than the adapter I first proposed: the real client, token refresh,
    retry, normalisation and view-model code all run, so the journeys exercise the actual
    paths instead of a parallel fake that can drift.
  - Sign-in reuses the existing loopback-only `/debug/sign-in`; a seed script writes the
    listener row and a `tidal_auth` row through `dbTokenRowStore` with a test
    `TIDAL_TOKEN_ENC_KEY`. No real account, token or TIDAL request is involved.

  If this guard work is judged too invasive at phase 6, the fallback is to run the journeys
  without a connection and accept that they cover the shell, navigation, sheet and
  accessibility but not catalogue content. Say so in the record rather than claiming coverage.

- **Visual regression (optional)**: `toHaveScreenshot` for Home, Now, an album and Search, per
  bucket and theme, with baselines on Linux CI only.
- **Physical acceptance**: extend the navigation-recovery checklist with:
  - sheet open/close by tap, swipe and Back
  - iOS edge-swipe Back with no double animation
  - tab re-tap
  - keyboard on Search (no zoom, results visible)
  - ten locked-screen track advances
  - Control Centre showing previous/next
  - a call interruption
  - a deploy while playing (audio must continue)
  - landscape on a Dynamic Island iPhone
  - one Android phone in Chrome and as an installed PWA

  Record pass/fail with device, OS and browser versions in this document.

## Delivery sequence

Each phase ships on its own, leaves the listening flow working, and keeps every theme intact.

| Phase | Scope                                                                                                                                                                                                                                                                          | Why first                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 0     | Device matrix + WebKit layout project + diagnostics panel; safe-area/keyboard tokens; 16px inputs; hover guards; `vh`/`vw` removed via container units in Now; `text-size-adjust`; mobile `+error.svelte`; server-rendered mini player; artwork `srcset`. No visible redesign. | Fixes concrete bugs and creates the safety net the later phases are judged by. |
| 1     | Player as a sheet with shallow routing; queue/lyrics/credits as sheet views; dialog semantics; swipe-up from the mini player; persistent-chrome view transitions.                                                                                                              | The single biggest "feels like Spotify" change; fixes close-player reloads.    |
| 2     | Navigation model: drop to three tabs, per-tab stacks, re-tap semantics, iOS swipe-back guard, snapshots, in-app Back.                                                                                                                                                          | "Never lose your place."                                                       |
| 3     | Perceived speed: streamed loads + skeletons, seeded heroes, universal loads with private HTTP caching, the catalogue read memo, preload policy, navigation progress line, budgets measured.                                                                                    | Makes every tap answer immediately.                                            |
| 4     | Interaction details: snackbar + undo, action-sheet header and gestures, row swipe-to-queue and now-playing marker, collapsing detail headers, Home quick tiles, Search recents and chips, Library sort/toggle.                                                                 | Polish on top of a now-stable frame.                                           |
| 5     | Audio hardening: `bragi-audio` Media Session music mode (release + re-pin), audio session, interruptions, buffering threshold, bfcache, background advance verification, sleep timer, deploy-safe chunks.                                                                      | Needs the device lab from phase 0.                                             |
| 6     | Acceptance: Playwright device journeys, axe per theme, perf budgets on throttled Android, physical checklist on iPhone + Android.                                                                                                                                              | Done means accepted on hardware, not only green CI.                            |

Phases 0 and 5's `bragi-audio` work can proceed in parallel. Every phase runs
`pnpm check && pnpm lint && pnpm test:unit -- --run` plus `pnpm test:storybook`, and
`pnpm lint:types` for async/player changes.

## Decisions

Settled with the owner on 2026-10-06. Each is written into the workstream it affects.

| #   | Decision                                                                                                                                                        | Status                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | **Three tabs** — Home, Search, Library; the mini player is the way into the player. Supersedes the four-tab composition in the navigation-recovery plan.        | Accepted (workstream A)     |
| 2   | **Player is an overlay sheet**, not a route-based screen. Supersedes the full-screen Now composition in both earlier plans; `/now*` stay as deep links.         | Accepted (workstream A)     |
| 3   | **Server-side catalogue read memo** — process-local, 60s, bounded, single-flight, catalogue reads only, no Redis tier.                                          | Accepted (workstream C)     |
| 4   | **Deterministic e2e data** — needed for the phase 6 journeys, but as one dev-only, loopback-only base-URL override plus a fixture server, not a second adapter. | Accepted, reduced scope (I) |
| 5   | **Separate user queue vs context** — one queue stays. The UI must not imply a split.                                                                            | Declined (workstream D)     |

Still to settle, when their phase starts rather than now:

- Whether the 768px site-entry cutoff moves or is replaced by a capability test, once a real
  foldable measurement exists (finding 14, workstream G).
- Whether visual-regression baselines are worth their maintenance cost (workstream I).
- Whether the deploy-safety mitigation needs the retained-`immutable/` fallback, which depends
  on measuring the precache budget first (workstream H).

## Files most likely to change

- `src/routes/(mobile)/+layout.svelte`, new `src/routes/(mobile)/+error.svelte`, `src/app.html`
  (viewport meta)
- `src/lib/mobile/{navigation,gestures,site-entry}.ts`, a new `src/lib/mobile/tabs.ts` (pure tab
  stack logic, unit-tested) and `src/lib/mobile/testing/device-matrix.ts`
- `src/lib/components/mobile/`: new `NowPlayingSheet`, `Snackbar` and `DisplayDiagnostics`;
  changes to `NowPlayingScreen`, `MiniPlayer`, `NowTabBar`, `QueueScene`, `MobileSearch`,
  `MobileTrackRow` and the detail components
- `src/routes/(mobile)/**/+page{,.server}.ts`: streaming, universal loads
- `src/routes/layout.css`: safe-area, keyboard and gutter tokens only; **no theme values change**
- new `src/lib/server/tidal/catalogue-cache.ts` (decision 3), plus the call sites in
  `api.ts`/`load.ts` that route through it
- `src/lib/server/tidal/config.ts` and the modules holding `api.tidal.com` literals, to collect
  the hosts behind the guarded dev override (decision 4), with `src/env.ts` and `.env.example`
- `bragi-audio` (separate release): Media Session music mode
- `vite.config.ts`, `playwright.config.ts`, `package.json` (`test:e2e` installs WebKit)
- Both Paraglide catalogues for every new label (`i18n-coverage.spec.ts` enforces this)
