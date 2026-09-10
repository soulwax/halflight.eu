# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The taste engine now has an era knob: pick a decade on `/app/generate` and picks are scored by how close their release year sits to that centre (±8 years), a transparent request-fit term that stays neutral for undated tracks so it only ever nudges.
- The taste engine now has a minimum-length knob that filters out interludes and skits below the chosen floor (1 / 1.5 / 2 minutes); tracks with an unknown duration are kept.
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

### Fixed

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
