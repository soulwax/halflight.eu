# Overall Halflight UX/UI plan

Status: proposed. Reviewed against the product architecture and existing shell, Home, player,
navigation, and shared component code on 2026-10-02. This is a delivery plan, not a completed audit
of every screen on physical devices.

## Product goal

Make the whole app feel like a coherent music service: connect an account, find something,
play it, manage what comes next, save a useful session, and return later. The listening session
remains the center of the product on both desktop and mobile.

Familiar streaming-app conventions guide control placement and action names. Halflight keeps its
own visual identity and existing themes. Improve basic workflows before expanding discovery,
recommendations, social features, or personalization systems.

The detailed mobile control specification lives in
[Mobile player controls and UX/UI](mobile-player-ux-plan.md). This document owns the wider product
experience, including desktop, setup, information architecture, and shared interaction patterns.

## Core journeys and completion criteria

| Journey            | Intended experience                                                      | Completion condition                                                                                 |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| First use          | Sign in, connect TIDAL, understand full-playback readiness, select music | The user can reach audio without learning OAuth terminology or confusing the two authorization flows |
| Return later       | Home leads with the accepted resumable session                           | One deliberate Resume action starts music; restore itself remains silent                             |
| Browse and listen  | Search or library → recognized item → play or queue                      | Context, query, filters, scroll, and existing playback survive navigation                            |
| Change the session | Open queue, reorder/remove/add, inspect what is next                     | Changes have clear feedback and recoverable persistence states; duplicates remain distinguishable    |
| Save work          | Save a queue or playlist to a named destination                          | Pending, success, failure, and any provider publication are explicit; no double submission           |
| Move devices       | Inspect track/position and select Play here                              | Visiting another device does not interrupt the one playing; takeover is deliberate                   |
| Recover            | A failed request names the failed task and a useful next action          | Audio and accepted local edits survive; retry/reconnect does not silently replace the session        |

## Information architecture

### Desktop: Listening Room

- Keep a stable sidebar for Home, Search, Library, and existing secondary music destinations.
  Group generator/taste tools below everyday listening tasks; place account/admin controls in
  a clearly secondary location. Do not create new primary destinations for every feature.
- Keep one recognizable search entry in the header and a full search destination for results.
  Header suggestions and the result page use the same names, artwork, and play/queue semantics.
- Keep the docked player visible through route changes. Expanded player/queue/lyrics views use
  the same session. Floating mode stays optional and must remain recoverable by keyboard.
- Use the optional aside for queue or context only where the remaining content is comfortably
  usable. Collapse that region before squeezing track identity or transport.
- Clarify selected navigation, page title, and return path on nested detail/settings routes.
  A generic Back to Search link should not replace a known library or playlist origin.

```text
┌─────────────┬─────────────────────────────────────┐
│ Navigation  │ Search                   Account    │
│             ├────────────────────────┬────────────┤
│ Home        │ Main listening/browse   │ Optional   │
│ Search      │ content                 │ queue or   │
│ Library     │                        │ context    │
│ Secondary   │                        │            │
├─────────────┴────────────────────────┴────────────┤
│ Track identity     Transport + seek    Utilities  │
└──────────────────────────────────────────────────┘
```

### Mobile: Halflight Now

- Four labelled destinations: Home, Search, Library, Now. Settings and focused detail/reading
  screens remain secondary. Mini player and navigation have reserved space and safe areas.
- Now is a full-screen listening destination, with a predictable return to the preceding task.
  The linked mobile plan specifies transport, seek, mini player, and subroute behavior.
- Share player commands, display models, and session reconciliation with desktop. Share UI
  primitives where helpful, while keeping separate layouts and densities.
- Narrow desktop layouts remain usable without forcing a redirect or remounting playback.
  Choosing the mobile site is explicit; changing sites never implies autoplay or takeover.

## Screen specifications

### Connection, sign-in, and first-run setup

- Explain account sign-in and TIDAL connection as separate steps. Preserve the intended internal
  destination through sign-in and authorization; show useful cancellation/failure recovery.
- Describe browse readiness and full-song playback readiness in plain language. Present the
  extra full-playback authorization as a named step when required, with code, waiting, success,
  expiry, and retry states. Do not pretend browse login alone guarantees full playback.
- After success, provide a clear Continue/Search/Resume action rather than another setup wall.
  Ask for installation only when requested or at a suitable later point, never before listening.
- Surface connection problems at the affected action and in Settings. Avoid multiple repeated
  banners for the same problem throughout the shell.

### Home

- First priority is continuing the current session. Show artwork, track/artist, playback state,
  and one primary action: Resume, Pause, or Play here as appropriate.
- Without a session, lead with an existing saved work or a clear Search/Library path. Existing
  mixes/generation can remain secondary; do not add more recommendation rails during this work.
- Keep section counts bounded, eliminate duplicate calls to action, and give empty states one
  useful next action. The page should explain what to do even before any history exists.

### Search and catalogue browsing

- Keep the query visible and URL-backed. Search results group tracks, albums, artists, and
  playlists with recognizable artwork, titles, and explicit result types where needed.
- Tapping a track's primary action plays it in context; tapping album/artist/playlist identity
  opens detail. Keep separate queue and overflow actions reachable by touch and keyboard.
- Preserve query/filter/scroll when returning from detail. Cancel obsolete requests and retain
  existing timeout/retry behavior; avoid an empty flash that looks like a successful zero result.
- Distinguish initial state, loading, no matches, disconnected, expired sign-in, and service
  failure. Show a recovery action for the failed task without resetting unrelated playback.

### Library and detail

- Make local playlists, TIDAL favorites, and private music recognizable destinations with clear
  labels for where each collection is stored. Keep filters stable and pagination discoverable.
- Standardize album/playlist detail: artwork and identity, prominent Play, queue actions, then
  track list. Artist detail follows the same hierarchy with releases below the main identity.
- Make duration/count and selected/playing states consistent. Keep lyrics, credits, and lengthy
  metadata secondary to listening actions; failures there cannot block the player.
- Avoid dense desktop tables on phones. Desktop lists may retain useful metadata columns while
  their action names and keyboard behavior match the mobile equivalents.

### Session, queue, and save flows

- Visually distinguish the current track, upcoming entries, and history. Highlight the actual
  playing occurrence instead of marking every duplicate track as the same queue entry.
- Keep reorder/remove/clear/save visible. Provide accessible move controls alongside dragging;
  preserve entry IDs, operation IDs, revisions, and conflict reconciliation.
- Review destructive clear/replace and external TIDAL publication. Routine playback and queue
  additions need immediate feedback, not extra confirmation dialogs.
- Save names its destination and distinguishes Halflight storage from provider publication.
  Disable duplicate submission while pending; present partial/failure outcomes where applicable.
- If adding Undo for removal, implement reconciliation against the operation and current queue;
  do not present a cosmetic Undo that can overwrite later edits.

### Settings and utility screens

- Order settings by listening needs: connection/full playback, data/quality and audio preferences,
  existing appearance/language controls, then optional integrations and advanced diagnostics.
- Make actual playback quality distinct from the requested preference; explain when a preference
  takes effect. Save success/failure stays beside the relevant form.
- Keep account token reveal in an explicitly opened advanced section. Shared server configuration
  remains readiness information rather than personal editable account settings.
- Keep admin tools separate from ordinary account Settings. Existing authorization boundaries
  apply to every page/action; UX changes do not create a new tenancy or permissions system.

## Shared visual and interaction system

Use the existing semantic tokens and themes in `src/routes/layout.css` as the source of truth.
The older `docs/style-guide.html` is not the current implementation reference.

| Pattern      | Standard                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Typography   | Consistent heading/body/metadata roles; readable secondary text, full accessible names, no tiny essential actions                   |
| Surfaces     | Canvas → content → focused/selected surface; restrained borders and shadows rather than a different card treatment for every screen |
| Artwork      | Consistent sizing/radii within each list type; stable placeholders, meaningful alt text when informative, lazy loading offscreen    |
| Buttons      | One primary action per task; predictable secondary/ghost/destructive treatments and visible pressed/disabled/pending states         |
| Navigation   | Selected item is visible without relying on color; preserve route/scroll context and provide a safe direct-link fallback            |
| Menus/sheets | Same action vocabulary; semantic triggers, keyboard operation, focus management, and dismissal that does not affect playback        |
| Forms        | Labels, inline validation, preserved input on failure, a named save action, and local success feedback                              |
| Feedback     | Local pending/success/error next to the task; persistent recovery while unresolved; no repeated global toast storm                  |
| Loading      | Reserve final geometry; bounded requests; never imply success merely because a request was sent                                     |
| Motion       | Short state/navigation transitions; reduced-motion equivalents; no continuous decorative animation                                  |

Playback status, connection status, and session-save status are separate. A saved queue is not
proof of audio, a network hint is not proof of server reachability, and a loading indicator is
not proof that playback has started. Use plain English/German messages for the actual state.

Reuse `Button`, `Notice`, `Dialog`, `ViewHeader`, `SectionHeader`, existing music widgets, and
mobile headers. Add a reusable variant only when an existing consumer needs it. Do not add a
new UI library, styling framework, icon set, or generic component configuration system.

## Delivery order and artifacts

1. **Baseline the real workflows.** Capture representative desktop/mobile screens in their
   current theme; inventory action/state inconsistencies. Include empty, loading, failure,
   long-title, German, and playing-elsewhere states. Record findings in this plan, not a new
   analytics service. Start with the existing cold-open/resume priority.
2. **Ship reliable playback and mobile controls.** Follow the mobile plan's first three slices.
   Apply corrected transport/state meanings to desktop too, without rebuilding its composition.
3. **Unify browse and queue actions.** Align search, lists, detail return paths, queue feedback,
   save destinations, and confirmations across both sites. Deliver complete journeys one at a time.
4. **Improve setup and Settings.** Make dual connection readiness and recovery understandable,
   keep advanced controls secondary, and simplify form feedback and return navigation.
5. **Finish the visual pass.** Align typography, spacing, surfaces, artwork, menus, and headers
   through the existing tokens/components. Improve desktop rail/header/player balance alongside
   mobile density. Verify real content before expanding the style system.
6. **Accept on actual devices.** Complete the journey/accessibility matrix and record remaining
   browser limitations. Polish optional gestures only after ordinary controls pass.

For each slice, record the problem, proposed UI/state change, files affected, screenshots when
useful, and acceptance result. A change should improve a named task and leave the app usable
before moving to the next slice. Deployment changes are separate from this documentation task.

## Acceptance gates

- Desktop at laptop and wide-screen sizes: rail, content, optional aside, and player never compete
  for the same space; scrolling, keyboard shortcuts, menus, and floating/docked modes remain usable.
- Mobile at 320px/390px, short-screen and landscape: navigation and essential transport remain
  reachable, the keyboard does not cover commit controls, and safe areas are respected.
- Both sites support English/German, 200% text, reduced motion, keyboard access, visible focus,
  meaningful screen-reader state, and adequate contrast. Mobile targets are at least 48px.
- Run each core journey above with an existing session and an empty account, plus disconnection,
  failed requests, expired sign-in, and playback on another device. No navigation interrupts audio.
- Use focused unit/browser tests for changed behavior and a small end-to-end set covering setup,
  resume, search → detail → queue, save, and recovery. Reuse current Storybook accessibility checks.
- For code implementation, run and report `pnpm check`, `pnpm lint`, `pnpm test:unit`, and
  `pnpm test:storybook`; include `pnpm lint:types` for async/token changes. Check the production
  build and real iOS/Android playback behavior when the changed journey requires it.

Success is fewer ambiguous actions and dead ends, one deliberate action to resume, predictable
navigation, and the same understandable session on both sites. Visual polish serves those tasks.
