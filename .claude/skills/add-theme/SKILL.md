---
name: add-theme
description: Add, edit, or verify a visual theme in Halflight/Syn — the app has four (dark, light, warm-night, electric), each with its own colour, radius, shadow, motion, and heading typography, not just a recolour of the same shapes. Use this whenever someone asks to add a new theme or dark/light mode variant, change how an existing theme looks, or wants to verify that a theme actually renders correctly — and also before touching src/routes/layout.css's theme registry, src/lib/theme.ts, or the Appearance settings pages for any reason. The colour-only part of this system is easy to get right by reading the code; the part that silently breaks (a theme's radius/shadow/motion/font falling back to dark's values while every colour keeps working, invisible to every unit test and to code review) can only be caught by actually running the app, which is why this skill exists and is not just a comment in the CSS file.
---

# Adding or changing a Halflight theme

A theme here is a full personality, not a palette swap: colour, corner
radius, shadow depth, motion timing, and heading typography (font, weight,
tracking, case) all vary together. Electric's headings are an uppercase
monospace readout inside near-square, neon-edge-lit corners; Light sets
headings in an editorial serif over a crisp, flat, softly-shadowed frame.
`#lib/theme.ts`'s own file comment is the living "how to add a theme"
reference — read it first, this skill adds the verification step that
comment can't enforce on its own.

## The five touch points

Each is small, and all but the CSS block are self-checking — the compiler
or a test catches you if you skip them, so a missed one surfaces as a red
`pnpm check`, not a silent gap:

1. **`src/lib/theme.ts`** — add the id to `THEMES`, then add its entry to
   `THEME_META` (`nameKey`, `descriptionKey`, `colorScheme`). TypeScript
   refuses to compile until `nameKey`/`descriptionKey` name real message
   functions, which forces step 2.
2. **`messages/en.json` and `messages/de-de.json`** — add
   `theme_<id>_name` / `theme_<id>_description` to both.
   `i18n-coverage.spec.ts` fails the build on a missing translation in
   either direction.
3. **`src/routes/+layout.svelte`'s `MOBILE_CHROME_COLOR` map** — add the
   new id with a literal hex string matching the theme's `--paper`. This
   drives the mobile browser/OS chrome colour (the `<meta name="theme-color">`
   tag), which has to be a real string at head-render time and can't be a
   CSS custom property reference — it's the one place a theme's colour is
   deliberately restated outside `layout.css`, and it's easy to forget
   because every _other_ per-theme value lives in exactly one place.
   `Record<LayoutData['theme'], string>`'s type means TypeScript refuses
   to compile with a theme missing here, so — like steps 1–2 — you cannot
   silently skip it; you'll just be confused by a `pnpm check` failure
   pointing at this file if you do, since nothing about `theme.ts` or
   `layout.css` hints that this file exists at all.
4. **`src/routes/layout.css`** — add a `[data-theme='<id>']` block in the
   "Theme registry" section near the top of the file. Colour tokens (down
   to `--focus-ring`) are the one _required_ part; everything past that —
   `--radius-*`, `--shadow-panel`/`--shadow-float`, `--dur-*`/`--ease-out`,
   `--font-heading`/`--heading-*`, `--focus-ring-*` — has a default in the
   shared `:root` block right above the theme registry, so redeclare only
   what this theme should do differently. `dark`'s own block is pure
   colour for exactly this reason: its values _are_ the defaults. This is
   the one touch point nothing enforces for you — see the cascade-order
   section below before you add it.
5. **No database migration.** `user_appearance.theme` deliberately has no
   CHECK constraint — `THEMES` in `#lib/theme.ts` is the one place that
   decides what's valid, checked by `isTheme`/`parseThemeSettingsInput`.
   Adding a theme is a pure application-layer change.

`THEME_META`/`getThemeLabel` already drive both the desktop and mobile
Appearance settings pickers generically, and `.storybook/preview.ts`'s
toolbar theme switcher reads `THEMES` too — neither needs touching.

## The one gotcha that isn't self-checking: cascade order

**The shared `:root` defaults block in `layout.css` must be declared
_before_ the four `[data-theme='…']` blocks, not after.** `:root` and
`[data-theme='…']` both match `<html>` at identical CSS specificity, so
for any custom property both declare, whichever block is textually _last_
in the file wins — regardless of which one looks more "specific" or which
one you intended to win. If the shared defaults ever end up after the
theme registry again, every theme's radius/shadow/motion/heading silently
reverts to dark's values while every colour keeps working perfectly,
because colour tokens have no competing default to lose to. That's not a
hypothetical: it happened in this exact file, passed `pnpm check`,
`pnpm lint`, and all ~900 unit tests, and was only caught by running the
app and reading real computed styles from a live browser. There's a
hazard comment at the top of `layout.css`'s shared `:root` block — if
you're moving code around in that file, read it before you do.

This is exactly why the next section is not optional.

## Verify by running the app, not by reading the CSS

A theme "looking right" in your head from reading hex codes and
`clamp()` calls is not evidence. Colour is the one part of this system
that's easy to eyeball and easy to get right by inspection; radius,
shadow, motion, and font are the part that silently breaks in ways no
unit test in this repo can see (component tests and, until recently,
Storybook don't even load `layout.css`). So:

1. Start the dev server if it isn't already running: `pnpm dev` (default
   `http://localhost:5173`, or the next free port if that one's already
   taken by another running instance — pass `--base=` accordingly; the
   first request after starting takes 10s+ while Vite compiles the route,
   don't give up early). In a fresh worktree or checkout, `.env` won't
   exist yet (it's gitignored) and the server needs the vars it declares
   unconditionally — copy one in from a checkout that has it before
   starting, and don't commit it.
2. Run the bundled inspection script from the project root (it needs
   `playwright`, already a project dependency, resolved via the project's
   own `node_modules` — copy it in, run it, remove it):
   ```sh
   cp .claude/skills/add-theme/scripts/inspect-themes.mjs ./.tmp-inspect-themes.mjs
   node ./.tmp-inspect-themes.mjs --themes=dark,light,warm-night,electric,<new-id>
   rm ./.tmp-inspect-themes.mjs
   ```
   It sets the `hf-theme` cookie for each theme (no login needed —
   `/sign-in` is public and has a real `<h1>`), loads the page, and prints
   back the _actual resolved_ `--radius-md`, `--shadow-panel`,
   `--font-heading`, and friends read straight off `<html>` — plus the new
   theme's real computed `<h1>` style. It also flags outright if every
   theme reports an identical `--radius-md`, which is the signature of the
   cascade-order bug above coming back.
3. Read the output. Every theme's non-colour tokens should differ from at
   least dark's, in the way you intended — if you gave the new theme a
   distinct radius but the script reports `10px` (dark's value) for it
   too, something upstream of the theme block isn't applying.
4. Pass `--out=<dir>` to also save a screenshot per theme and actually
   look at it. Numbers proving the tokens resolved don't tell you the
   result looks _good_ — legible, not broken, the tracking/weight/case
   combination reading as intentional rather than accidental. This step
   caught a sign-in heading fix that looked risky in the diff (removing
   `letter-spacing: -0.05em` on a much larger heading than the token was
   tuned for) but turned out to read as clearly intentional once actually
   rendered.
5. If you're testing against an isolated worktree or a fresh checkout
   rather than this working copy, the same script works — just make sure
   the dev server it's pointed at (`--base=`) is the one you actually
   changed.

Don't skip straight to `pnpm check && pnpm lint && pnpm test:unit` and
call it done — those are necessary, not sufficient, for this system
specifically. Run them too, but they are not what tells you the theme
works.

## Designing a theme that actually reads as distinct

Colour is necessary but not sufficient for a theme to feel different —
that's the whole premise of this system. When picking non-colour values
for a new theme, lean on the tokens that already ripple through the whole
app for free, because most components reference them directly rather than
hardcoding their own:

- **`--radius-xs` through `--radius-xl`** — the corner language. Sharp
  (Electric: 2–8px) reads technical/HUD; round (Warm Night: 6–22px) reads
  cosy; the existing default (4–16px) is the calm middle ground.
- **`--shadow-panel` / `--shadow-float`** — depth character, not just
  colour. A pure black shadow, a warm-tinted one (Warm Night mixes in
  amber-black rather than pure black), or a glow using the theme's own
  accent via `color-mix(in oklab, var(--action) 55%, transparent)`
  (Electric drops the drop-shadow model entirely and uses an edge-lit
  glow instead).
- **`--font-heading` / `--heading-weight` / `--heading-tracking` /
  `--heading-transform`** — read only by the shared `h1,h2,h3` rule, so
  changing them restyles every real heading in the app for free. Stick to
  system font stacks (no `@font-face`, no Google Fonts link — this app
  deliberately has neither, and every existing "font" name in
  `--font-display`/`--font-mono` is a fallback list, not something
  actually loaded). `text-transform: uppercase` is a legitimate choice
  here (Electric), not just a novelty.
- **`--dur-fast`/`--dur-med`/`--dur-slow`/`--ease-out`** — motion
  character. Faster + a punchier cubic-bezier reads energetic; slower
  reads unhurried. Don't touch `--fs-*` (type _size_): those stay
  identical across themes on purpose, so density and layout never shift
  when the owner switches looks — character comes from the heading tokens
  above, not from making text bigger or smaller.

## Components that don't inherit the theme's heading identity on purpose (or by oversight — check)

A handful of headings have their own hardcoded `font-weight`/
`letter-spacing`/`text-transform` instead of inheriting from the shared
`h1,h2,h3` rule. Two are already fixed (`ViewHeader`'s `<h1>` — the "one
hero line per view" shared by nine routes — and the sign-in page's own
`<h1>`), both confirmed to have been silently blocking their theme's
identity before the fix. Others were deliberately left alone:
`SectionHeader`'s permanent uppercase eyebrow-style label is an
established, size/role-specific identity, not an oversight, so it wasn't
forced into the theme system. If you find another hardcoded heading style
while working on this (`grep -rn "font-weight: 7\|font-weight: 8" src/lib/components`
is a reasonable starting search), don't assume either answer — check
whether it reads as a genuine "hero heading" that should carry the
theme's character, or a deliberate, independent micro-typography choice
like `SectionHeader`'s, and verify whichever you pick by actually running
the app per the section above rather than guessing from the component's
name.
