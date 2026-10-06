# Mobile player controls and overall UX/UI plan

Status: core implementation delivered; physical-device acceptance remains open. Updated 2026-10-02.

The parent [Overall Halflight UX/UI plan](overall-ux-ui-plan.md) covers the complete desktop and
mobile product, setup, information architecture, and shared visual/interaction system. This
document specifies the first mobile playback delivery workstream.

## Outcome and priorities

Make Halflight feel familiar to someone who uses a mobile music player: find music, start it,
control it with one hand, change the queue, and return to browsing without losing the session.
Use Spotify-like interaction conventions while keeping Halflight's existing artwork-led visual
identity. Improve the full product UX, with mobile playback as the first delivery priority and
desktop retaining its Listening Room composition.

The first release focuses on reliable play/pause, previous/next, seeking, shuffle/repeat, queue,
resume, and understandable failures. Discovery algorithms, recommendations, crossfade, downloads,
and native background playback are separate work. No new package or database schema is needed
for the initial UI work.

## Current foundations and concrete gaps

| Area               | Already implemented                                                                                             | Work to plan                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Full player        | Artwork, identity, seek preview/commit, previous/play/next, shuffle/repeat, quality, queue/lyrics/credits links | Stable layout on small screens, truthful pending/fallback states, more informative repeat labels                                       |
| Mini player        | Artwork/title/artist, play/pause, progress, link to `/now`                                                      | Increase its 40px button target to 48px; add next and a visible playback-location/recovery cue where needed                            |
| Navigation         | Mobile routes, layout-mounted singleton, per-route scroll restoration                                           | Current header exposes Search/Library icons; implement the master plan's four labelled primary destinations and reserved bottom region |
| Return from Now    | Explicit close link                                                                                             | Close currently always opens Home; preserve the actual originating screen and its scroll/query                                         |
| Seeking            | Local preview, one seek on commit, pointer cancellation, track-change reset                                     | Enlarge the hit region, reject unknown-duration/fallback seeking, use shared scrub methods after checking track-change cancellation    |
| Transport          | Shared player commands and Media Session handlers                                                               | Match disabled states to command behavior at history/queue boundaries and while another device owns playback                           |
| Recovery           | Queue persistence states, retry and reconciliation, explicit Play here on Now                                   | Present these states consistently in mini player, Now, Home resume, and queue without confusing sync failure with audio failure        |
| Supporting screens | Search, library, detail pages, queue reorder/remove/save                                                        | Consistent actions, feedback, navigation, density, and connection setup on mobile                                                      |

Specific issues visible in the current code:

- Shuffle and repeat targets are 44px. The five-control row's fixed widths and gaps need a
  narrow-screen pass; reducing artwork alone will not solve transport overflow.
- The seek range uses a fabricated maximum of 100 when duration is unknown. The UI should show
  an unavailable seek control until a meaningful duration and controllable playback exist.
- Previous uses `currentTime > 3`, while its disabled condition uses `< 3`. Next is enabled for
  repeat-one with an empty queue, although a manual next in that state does not advance. Align
  availability with the actual commands, with explicit tests for these boundaries.
- Loading replaces the play icon with a spinner while its label still follows `isPlaying`.
  Add a truthful pending announcement and define how repeated taps are handled.
- In embed mode, `togglePlayPause()` only opens the provider-controlled player. Mobile Now needs
  a visible fallback destination; it must not imply that its direct transport controls operate
  the embed.
- The shell uses `min-height: 100dvh`. Verify that this constrains one scrolling content region
  at every content length; the reserved mini player/navigation region must remain reachable.

These are implementation findings, not claims about which journeys fail on a real phone today.

## Intended mobile composition

### Browsing shell

```text
┌────────────────────────────────────┐
│ Screen title              Settings │
│                                    │
│ One scrolling content region       │
│ Search / library / detail content  │
│                                    │
├────────────────────────────────────┤
│ Art  Track · Artist     Play  Next  │
│ ━━━━━━━ playback progress ━━━━━━━━ │
├────────────────────────────────────┤
│ Home    Search    Library    Now    │
│          bottom safe area          │
└────────────────────────────────────┘
```

- Reserve layout rows for mini player and labelled navigation; never cover the final list row
  with fixed controls. Use a viewport-constrained shell, safe-area padding, and a scrolling main.
- Tapping mini-player identity opens Now; play/pause and next are separate semantic buttons.
  Never nest a button inside the identity link or make the whole bar intercept control taps.
- The mini player appears whenever a track exists, including when paused. It never becomes a
  second engine. Small progress is informational; seeking belongs in Now.
- Keep its title and artist readable at 320px. On exceptionally constrained layouts, retain
  play/pause and open-Now access before adding next.
- Home, Search, Library, and Now have text labels and selected states. Settings is secondary.
  Keep the existing full-screen Now behavior: hide shell chrome on `/now`.
- Queue/lyrics/credits need access to transport as the master plan requires. Use a compact
  mobile transport on these subroutes, backed by the same singleton, without duplicating the
  full-screen player or hiding it behind a reading view.

### Full-screen Now Playing

```text
┌────────────────────────────────────┐
│ Close     Playing from…   Actions  │
│                                    │
│              Artwork               │
│                                    │
│ Track title                        │
│ Artist · optional album link       │
│ Actual quality / playback location │
│ ━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━ │
│ 1:24                         −2:16 │
│ Shuffle  Previous  PLAY  Next Repeat│
│                                    │
│ Queue              Lyrics  Credits │
│          bottom safe area          │
└────────────────────────────────────┘
```

- Use a 64px central play/pause control and at least 48px targets for surrounding controls.
  At 320px, use 16px side padding and at most 8px transport gaps so five controls fit.
- Keep title, progress, and transport in stable positions during loading and track changes.
  Let long titles occupy two lines; artist/album links expose complete accessible names.
- Keep artwork dominant on tall screens. Shrink it for short screens and landscape before
  shrinking control targets. Allow scrolling when enlarged text cannot fit safely.
- Move queue, lyrics, and credits into a secondary row near the controls. Playback location and
  actual quality are concise status information, not extra permanent buttons.
- Close returns to the originating mobile route, retaining its query and scroll. Use SvelteKit
  navigation/state and a validated internal return target; direct links fall back to Home.
  Browser Back follows normal history. Do not blindly call Back to an external origin.
- Keep explicit Close. Optional swipe-to-dismiss comes after navigation works and cannot
  compete with scrubbing, scrolling, or platform edge gestures.

## Player behavior contract

| Control or state              | Required behavior                                                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play/pause                    | Issue one deliberate command and show observed playback state. Opening Now, restoring a session, or dismissing a sheet never starts audio.                                                                |
| Resolving/buffering           | Keep geometry and current context; name the pending state accessibly. Do not enqueue duplicate start requests. Retain only controls whose commands can safely run.                                        |
| Previous                      | Restart the current track after the existing three-second threshold; otherwise return through history. Make button availability match that exact threshold and preserve existing history/queue semantics. |
| Next                          | Advance once through the shared player. Manual next bypasses repeat-one. Disable it when no actual advance is available; repeat-all eligibility includes the available loop.                              |
| Shuffle                       | Toggle the existing shuffle behavior, show a non-color indicator and `aria-pressed`, and preserve queue entry identity. No smart shuffle.                                                                 |
| Repeat                        | Cycle Off → All → One → Off. Use a distinct repeat-one icon and a localized label naming the current mode and next action. Boolean `aria-pressed` alone cannot describe three states.                     |
| Seek                          | Preview elapsed/remaining time while dragging, clamp to known duration, commit one command on release/change. Cancel on pointer cancellation or track change; keyboard operation remains available.       |
| Unknown duration              | Show elapsed time where valid; make seeking unavailable rather than inventing a timeline. Avoid NaN, negative remaining time, and false buffer progress.                                                  |
| Playing elsewhere             | Name the location and offer Play here. Viewing or editing the queue never claims playback. Disable local seek while this device lacks playback control.                                                   |
| Playback failure              | Keep the selected item and queue. Offer a named Retry, reconnect, or explicit skip as appropriate; avoid unbounded retries and automatic skip chains.                                                     |
| Provider embed fallback       | Explain the change and display a usable provider-controlled player or a safe Open in TIDAL action. Only advertise controls that the active playback mode supports.                                        |
| Queue sync failure            | Keep locally accepted edits and current audio; show saving/retry/sign-in status separately from playback failure. Preserve revision and operation-ID reconciliation.                                      |
| Hardware/lock-screen controls | Reuse current `bragi-audio/player` Media Session integration and the same commands. Feature-detect support; verify behavior on physical phones.                                                           |

Do not add a permanent software volume slider to the first mobile player release; use device volume.
Keep quality preference in Settings, and label the format actually playing independently of that
preference. Do not advertise universal output selection or native background reliability.

## Overall UX/UI system

### Visual hierarchy and accessibility

- Reuse semantic tokens from `src/routes/layout.css`: canvas, raised/selected surfaces, text,
  borders, action, focus, danger, and success. Keep Halflight's typography and accents.
- Standardize spacing, control sizes, artwork radii, list density, and heading scale across the
  existing mobile components. Introduce local variants only for an actual consumer.
- Music leads: artwork, title, artist, then the primary action. Reduce repeated introductions,
  decorative borders, and technical detail that competes with that action.
- Meet contrast requirements, visible keyboard focus, screen-reader names/state, 48px touch
  targets, reduced motion, 200% text scaling, and English/German expansion.
- Reserve skeleton geometry; give missing artwork an owned placeholder. Avoid animated artwork,
  forced marquees, and automatic screen wake locks.

### Consistent actions and feedback

- A track row's primary action plays that track in its list context; album, artist, and playlist
  cards open detail. Keep artist/album navigation and overflow actions separate from transport.
  Audit existing call sites before changing behavior. Queue entries play their specific occurrence.
- Make Play now, Play next, Add to queue, and existing Save actions discoverable through a
  consistent mobile action sheet. Use existing UI primitives with focus trapping/restoration.
  Preserve desktop's denser menu where appropriate.
- Distinguish playing one track, playing an album/playlist, and replacing the listening queue.
  Review destructive clear/replace operations; routine play/pause and seeking need no dialog.
- Show brief local confirmation for a queue add or save. Keep unresolved failures visible beside
  the action with Retry. Use restrained live announcements, never every progress tick.
- Keep TIDAL publishing/writes separate from saving Halflight-owned state, with the existing
  reviewed action and destination/result semantics.
- Preserve search query, filters, scroll, and keyboard intent through detail navigation. Back
  should return to the user's task, not reset it.

### Screen-level improvements

| Surface        | First UX improvement                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home           | Resume is the main action when a session exists; show pending/failure states and explicit Play here when needed. Keep discovery below the current listening task.                               |
| Search         | Search field and relevant results lead; preserve current cancellation/URL behavior. Standardize detail/play/queue actions and keep results visible above the keyboard/player.                   |
| Library        | Recognizable saved work, clear filters, consistent play/add controls, helpful empty-state action, and bounded pagination.                                                                       |
| Detail         | Artwork and identity, one prominent Play action, clear queue options, then the ordered track list. Keep lengthy metadata secondary.                                                             |
| Queue          | Current track and upcoming entries remain distinct. Preserve stable IDs, duplicates, drag plus accessible move buttons, and feedback/recovery. Clear names its destructive effect.              |
| Lyrics/credits | Readable type and safe scrolling, available transport, predictable return to Now; missing content does not become a playback error.                                                             |
| Settings       | Connection and full-playback readiness first, then quality/data preference and essential personal controls. Account token inspection belongs in a collapsed advanced section.                   |
| Desktop        | Use the same action names, state meanings, confirmations, and accessibility rules. Keep the docked player, side navigation, and useful density. Share logic and primitives, not mobile layouts. |

## Implementation sequence

Each slice should be independently reviewable and leave a working listening flow. Do not redesign
every screen before the first playback improvement ships.

1. **Reliable cold-open and playback states.** Continue the master plan's current next slice:
   restore without autoplay, resume deliberately, surface pending/failure/fallback/location states,
   and reconcile control availability with existing commands. Verify an actual audible-start path.
2. **Mobile shell, mini player, and return navigation.** Reserve bottom rows and safe areas;
   implement four labelled destinations, 48px mini controls, optional next, and correct return
   from Now. Keep transport available on Now subroutes and preserve route/query/scroll state.
3. **Now Playing transport and seeking.** Ship the responsive artwork/identity/progress/transport
   composition, exact previous/next eligibility, repeat labels, safe scrub lifecycle, accessible
   elapsed/remaining time, and honest fallback behavior.
4. **Browse-to-listen consistency.** Apply the action/feedback contract to search, library, detail,
   and queue. Confirm destructive changes, preserve pending operations, and provide local recovery.
5. **Overall UI polish and physical-device acceptance.** Align tokens, spacing, type, loading and
   empty states across mobile and desktop; test installed/browser contexts and fix real usability
   issues. Add gestures only if the explicit controls already pass.

Primary files to change when implementing:

- `src/routes/(mobile)/+layout.svelte` and `src/lib/mobile/navigation.ts`: shell and return behavior.
- `src/lib/components/mobile/{MiniPlayer,NowTabBar,NowPlayingScreen}.svelte`: player presentation.
- `src/lib/components/mobile/{MobileTrackRow,MobileSearch,MobileLibrary,QueueScene}.svelte`:
  action consistency and feedback; reuse existing detail/header components.
- `src/lib/player/player.svelte.ts`: only command availability/state gaps that UI cannot describe
  truthfully. Keep session persistence in `session-coordinator.ts` and audio in `bragi-audio`.
- Shared components, `src/routes/layout.css`, and both message catalogues: cohesive visuals/copy.

Extract a small mobile transport or seek component only when two mobile views consume it. Avoid a
configurable universal player or new audio engine. If package behavior needs a fix, implement it
in the Bragi package boundary and update Syn's pinned release before relying on it.

## Acceptance and verification

- At 320px, 390px, short-screen, and landscape sizes, primary controls remain reachable without
  overlap, horizontal scrolling, or clipped safe-area content. Verify with 200% text and German.
- Cold open restores track/position/queue/history silently; one Resume tap starts audio. Play,
  pause, next, previous, seek, and repeat states correspond to actual player behavior.
- Opening/closing Now, visiting queue/lyrics, changing tabs, and returning from a detail preserve
  audio, query, and scroll. An external/direct entry gets a safe internal return path.
- Seeking produces one committed command; track changes and cancelled gestures discard preview.
  Unknown duration, no next/history, repeat-all/one, and playing elsewhere have correct controls.
- Network failure, expired sign-in, failed startup, and embed fallback leave a usable screen.
  No button appears successful while doing nothing; queue persistence trouble never erases audio.
- Browser component tests cover changed interactions; server/pure tests cover command eligibility
  or reconciliation changes. Reuse existing coverage and add tests for behavior gaps rather than
  duplicate rendering assertions.
- Run the required repository checks for implementation: `pnpm check`, `pnpm lint`,
  `pnpm test:unit`, and `pnpm test:storybook`; run `pnpm lint:types` for async/token work.
  Add focused mobile end-to-end coverage for resume → Now → seek → queue → return.
- Verify iOS Safari and Android Chrome on real phones, with browser and installed contexts where
  available: lock/unlock, audio interruptions, hardware controls, orientation, keyboard, and
  reconnect. Record unsupported behavior accurately; Chromium alone cannot prove it.

Done means the owner can find music, start it, adjust playback, edit the queue, and return to the
same browsing context with one hand, while always understanding what is playing and what can be
retried. The plan itself makes no claim that these implementation gates have already passed.

## Implementation record — 2026-10-02

The initial delivery implements the core listening path and shared supporting actions:

- Home Resume issues a deliberate playback command; viewing Home or Now still does not start audio.
  Pending starts reject repeated taps. OS Play and Pause are separate, idempotent commands.
- Home, Search, Library and Now have visible bottom-navigation labels. The constrained shell
  reserves space for navigation and mini transport; queue, lyrics and credits retain mini transport.
  Close remembers the actual mobile browse route, query and existing scroll-restoration key.
- Now shares desktop transport and seek logic, with 48px surrounding controls, a 64px main control,
  current repeat-mode labels, elapsed/remaining time, track-bound scrub cancellation and disabled
  unknown-duration or fallback seeking. Artwork adapts to short and landscape screens.
- Recovery and queue-persistence status are shared across the player, Home and queue. Fallback
  has a deliberate retry, connection setup or a public TIDAL destination.
- Mobile track actions use a sheet with queue-add announcements. Both queue views confirm Clear
  and save a named snapshot with pending, error and confirmed success. Retry retains the save ID.
  Playlist-dialog creation and additions also wait for server confirmation.
- Mobile Settings leads with connection and full-playback readiness. Device authorization polling
  is sequential, expires and cancels on dismissal/unmount. Browse OAuth returns only to an
  allowlisted settings destination. Owner token inspection is collapsed under Advanced.
- The existing semantic theme system remains in use. Enlarged text no longer doubles the body's
  minimum width. Dialogs support reduced motion and larger close controls.

Focused browser coverage exercises narrow transport, German labels, enlarged text and landscape;
playback tests cover duplicate-start protection, retry preserving position/queue and explicit pause.
Server tests cover local-save defaults, retry identity and OAuth return boundaries.

Still open: physical iOS/Android sound, browser/PWA safe areas and keyboards, lock-screen commands,
and a complete contrast/screen-reader/theme review. Swipe gestures and optional effects remain
outside the initial delivery. The broader screen-by-screen polish is tracked in the parent plan.

## Cross-screen playback recovery — 2026-10-06

Playback errors now remain actionable in the shared Halflight Now shell while moving between Home,
Search, Library, details, queue, lyrics, and credits. The recovery strip carries the relevant action
for an unavailable track, expired or missing playback access, a TIDAL plan restriction, a temporary
stream failure, embed fallback, or playback owned by another device. Queue-save recovery appears
beside playback recovery in the shared shell, remains available without a current track, and keeps
its existing detail/retry dialog separate from audio status.
Home no longer repeats the same playback alert beneath its Resume card, and the mini player's
transport yields to the shared recovery action when playback needs intervention. Full-screen Now
Playing keeps its detailed in-context status. Automated checks pass; physical-device acceptance
remains open.
