# Navigation and listening recovery redesign

Written 2026-10-04. Status: core entry, navigation, and recovery implementation delivered;
live TIDAL and physical-device acceptance pending.
This plan takes precedence over earlier claims that mobile navigation is delivered or accepted.
It supplements [overall UX/UI](overall-ux-ui-plan.md) and
[mobile player controls](mobile-player-ux-plan.md).

## Problem and evidence

Implementation record: `/` now chooses the mobile or desktop shell from the CSS viewport
width after sign-in, with an explicit saved view choice taking priority. Sign-in preserves
validated internal return destinations. Both shells expose a view switch, and the desktop
mini-player title opens its expanded player. A single restored song gets a silent stream
readiness check; confirmed unavailable, authorization, plan, and temporary failures have
different recovery actions. Unknown stream errors return temporary status. The older local
queue journal format was invalidated following the owner's content reset. Automated checks
cover routing, error classification, API status, and the player identity action. Device and
live account validation are still required for acceptance.

The owner's four iPhone screenshots show sign-in, a restored Home session, an expanded
player dominated by placeholder artwork, and a track detail failure. The sequence leaves
the owner without a clear destination, playback status, or way back to listening.

Confirmed by repository inspection:

- `/` sends an authenticated administrator to `/app`. Sign-in redirects and GitHub/email
  callbacks also target `/app`. These entry points do not select the existing mobile shell.
- `/app` mounts the desktop player. Its `NowPlaying` title links to `/app/tracks/[id]`.
  Tapping a song name therefore opens catalogue detail rather than Now Playing.
- A distinct mobile shell already exists at `/home`, `/search`, `/library`, and `/now`.
  Its mini-player identity correctly opens `/now`; having that component does not make it
  the experience reached from the canonical domain after login.
- `loadSessionShellData()` reads stored playback state without checking current provider
  availability. The desktop Home resume card reads `player.currentTrack` directly.
- `filterPlayableTracks()` removes recently known negative playback records. It does not
  validate every song against TIDAL, and the stored resume snapshot bypasses that filter.
- Track detail can report not found following a provider 404 or failed normalisation.
  Broken artwork alone does not establish an unplayable recording.

Not established: the pictured recording's ID, live `/stream` and `/audio` outcomes,
token health, provider market restrictions, or which build served the screenshots.
Do not describe an API failure as database corruption or a permanent delisting without evidence.

## Entry and route contract

Keep the separate desktop and mobile compositions and the single listening session.
Make them reachable from the canonical domain; a new subdomain is not a prerequisite.

1. A validated internal return destination wins after authentication. Preserve query,
   locale, and requested site. Reject external URLs and protocol-relative destinations.
2. A saved explicit site preference wins for an unqualified entry. Provide “Mobile view”
   and “Desktop view” under Settings and retain that choice without redirect loops.
3. Otherwise a narrow browser chooses the mobile Home; a wide browser chooses `/app`.
   Use the existing shell breakpoint as the initial implementation boundary. Treat this
   as a viewport decision, not a guess about an iPhone model from its user agent.
4. Choose the shell before restoring/mounting the player. Once listening starts, rotation
   or resizing must not remount it, navigate automatically, or interrupt audio.
5. Explicit detail URLs remain usable. A site switch maps equivalent destinations and
   preserves IDs and supported query parameters. Unknown mappings go to that site's Home.
6. OAuth, email verification, reconnect, logout, and expired-session journeys preserve a
   safe return destination. All generated navigation uses localized paths.

Audit every entry point, including `/`, sign-in load/actions, GitHub callbacks, verification,
TIDAL callbacks, shared state cards, artwork/title links, and installed-PWA launch URLs.

## Navigation composition

| Surface                 | Primary navigation                                | Listening controls                                         | Secondary destinations                              |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| Mobile browse           | Home, Search, Library, Now bottom tabs            | Compact mini-player above tabs                             | Settings and Make a set in a labeled secondary menu |
| Mobile Now Playing      | Explicit Close/back to originating browse context | Artwork, title/artist, progress, transport, visible status | Queue, Lyrics, details, and track actions           |
| Desktop browse          | Stable sidebar and search                         | Persistent dock; identity expands Now Playing              | Settings, taste, generator, owner diagnostics       |
| Desktop expanded player | Visible collapse and current view label           | Same session and transport                                 | Queue, Lyrics, details                              |

Tabs represent destinations. Play/pause changes playback; it never navigates. Tapping
mini-player artwork or identity opens Now Playing on both sites. Catalogue details live
behind a labeled “Track details” action; artist/album links remain explicit inside details.
The Now tab remains useful with an empty session: show an intentional empty view with
Search and Library actions rather than a disabled control or blank panel.

The expanded player must always show title, artist, transport, status, and a way out.
Placeholder artwork cannot occupy the controls' space. Queue is a labeled, reachable view
within Now Playing, not an unlabeled table under an oversized image.

## Mobile screen specification

Browse composition, top to bottom:

```text
compact header: halflight / secondary menu
scrolling destination content
mini-player: artwork + title/artist | play/pause | next
Home             Search             Library             Now
bottom safe area
```

Now Playing composition, top to bottom:

```text
Close                     Now Playing                  More
bounded artwork or calm fallback
track title / artist
playback status and its recovery action, when needed
elapsed time / seek / duration
previous                  play/pause                    next
Queue                      Lyrics                     Details
bottom safe area
```

- Size artwork from available height, not only width. Transport and Close must remain
  reachable on short screens, in landscape, with Safari controls expanded, and with larger text.
- Use one scrolling content region. Reserve actual chrome height; avoid content hidden
  behind the player, tabs, keyboard, or Safari toolbar. Apply safe-area padding once per edge.
- Keep touch targets at least 44 CSS pixels. Provide visible focus and named icon controls.
- Home leads with a modest listening invitation. Resume is offered only for a session whose
  state supports it; an empty reset begins with Search, Library, or connection setup.
- Missing artwork uses an intentional fallback everywhere, including Home. Never expose
  the browser's broken-image marker. Missing metadata must not erase transport or status.
- Keep search query, filters, selected library section, and scroll when closing Now Playing
  or returning from details. Browser Back must follow the same understandable route history.
- Respect reduced motion, keyboard operation, screen readers, and English/German parity.

## Availability and API recovery contract

Catalogue availability, playback readiness, artwork delivery, and session persistence are
separate states. Present the failed task and the next useful action at the point of failure.

| Verified outcome                                 | User-facing behavior                                       | Session behavior                                              |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Restored, not yet checked                        | Check before advertising dependable Resume                 | Keep snapshot; restore silently                               |
| Confirmed unavailable recording                  | Explain briefly; offer Skip and Remove                     | Exclude from resume recommendations; preserve remaining queue |
| Browse/playback authorization missing or expired | Connect/reconnect with a return to listening               | Keep accepted queue and position                              |
| Account cannot stream                            | Explain playback access and offer supported TIDAL fallback | Keep session; avoid repeated automatic attempts               |
| Provider timeout, throttling, or network failure | Retry and an honest temporary status                       | Never label permanently unavailable or delete data            |
| Audio bytes or browser playback failure          | Show playback failure with Retry/fallback                  | Keep identity and controls visible                            |
| Artwork failure                                  | Render fallback                                            | Do not alter playback eligibility                             |
| Details unavailable during working playback      | Keep Now Playing; Retry details or return                  | Music continues                                               |

Validate the current resume candidate with bounded, injectable server logic. Apply known
negative filtering to restored candidates as well as lists. Do not stream-probe an entire
catalogue or queue on every page load. Persist removal only through revision-aware session
commands; a failed validation request must not replace an accepted queue with an empty one.
Known negatives need expiry and successful revalidation so recovered assets can return.

Audit the current `stream_unavailable` catch-all before deciding which failures may create
negative records. Only proven asset failures should exclude a recording. Missing tokens,
throttling, malformed responses, and transport failures must remain distinguishable.

Live diagnosis must record only safe status/error categories: detail, `/stream`, then `/audio`
status and browser media outcome. Never capture tokens, signed media URLs, audio, or raw
provider documents in the repository. Use the repository debug-playback workflow.

## Database fresh start

Executed 2026-10-04 following the owner's clarification: production listening/content
data only, preserving identity, connections, and preferences. Removed three Syn playlists,
one taste profile, twenty generation cooldowns, forty-eight availability records, and
thirty-seven playback operation outcomes. Emptied the playback snapshot and advanced its
revision to 1079. Verified selected content tables empty, no nonempty playback snapshots,
and retained identity/connection/settings rows. Cleared the owner's Redis pending-intent
buffer with application writes stopped and restarted the existing PM2 build. Private-upload
and provider-cache indexes were already empty. Physical-device and API diagnosis remain open;
the reset is not evidence of a repaired recording. Existing browser journals remain a limitation
until reset invalidation is implemented; close old tabs and reload before listening again.

A reset removes stale owned state; it cannot repair provider authentication, entry routing,
or a TIDAL recording. Identify the target database and obtain the owner's scope clarification
before irreversible deletion. The user's reset request is authorization; this clarification
resolves whether “entire database” includes identity and production data.

Prepare an exact table/count inventory using the live database schema, not just this document.

- Listening reset: explicitly enumerate playback state/operation outcomes, owned playlists,
  taste/generation data, and availability records. State separately whether settings remain.
- Full application reset: also remove identity/sessions, administrator grants, encrypted
  connections, preferences, and private-music records. The owner must sign in and reconnect.
- Preserve schema and migration history for an application-data reset. Dropping the database
  itself is a separate infrastructure operation and is unnecessary for a fresh application.
- Audit object indexes before deleting them. Private uploads and provider cache objects live
  outside Postgres; deleting their indexes can strand objects. Do not erase uploaded files or
  required cleanup indexes by accident. TIDAL-owned playlists are not deleted by a Syn reset.
- Quiesce app writes and pending persistence journals before resetting. Old open tabs must
  not silently repopulate the cleared session; implement/test reset invalidation or enforce
  a maintenance window and session invalidation appropriate to the selected scope.
- Execute the reviewed explicit reset transaction, verify empty selected tables and retained
  schema, clear relevant process/Redis caches and buffered intents, then verify fresh startup.
  Any recovery snapshot must be access-controlled and use durable infrastructure storage.

## Delivery order and acceptance gates

1. Resolve reset target/scope and gather safe live failure evidence. Verify the deployed
   revision. Do not erase diagnostic evidence before classifying the observed failure.
2. Implement entry/return routing and site choice. Test signed-out and signed-in canonical
   entry, GitHub/email sign-in, localized links, reconnect, and explicit site selection.
3. Implement bounded resume validation and distinct recovery states. Test unavailable,
   transient, authorization, bytes, artwork, and persistence failures independently.
4. Implement the navigation and player composition above. Extend existing pure navigation
   tests and browser tests for identity taps, Back/Close, empty sessions, queue, and focus.
5. Execute the selected reset after its old-client replay protection is ready; verify
   reconnect and a fresh listening journey against the same production environment.
6. Run formatting, `pnpm check`, `pnpm lint`, `pnpm test:unit`, `pnpm test:storybook`,
   and `pnpm lint:types` for async/token work. Build the deployment target before release.
7. Accept on the owner's physical iPhone in Safari: full screenshot journey, toolbar
   expansion/collapse, keyboard search, portrait/landscape, reload, lock/unlock, and Back.
   Measure `innerWidth`, `innerHeight`, DPR, and visual viewport on the device; screenshot
   image pixels include browser chrome and cannot define the CSS viewport. Also test a
   narrower phone, larger text, reduced motion, German, and desktop regression paths.

Release requires successful audio from a known playable recording, persistent navigation
without interruption, visible recoverable failures, and no obscured primary controls.
Automated green checks alone do not constitute physical-device or live-TIDAL acceptance.
