# Design: Per-edition theming + Tour de France light theme

**Date:** 2026-07-02
**Status:** Approved (design)

## Goal

Make the app's visual theme change based on the active race edition, and add a
light **Tour de France** theme. The Giro keeps today's dark theme; the Tour gets
a light, `#ff0`-highlight theme. The theme is chosen automatically from the
active edition — no admin action, no schema change.

## Background (current state)

- The design system is **token-first**: every color is a CSS custom property in
  `:root` in `src/app/globals.css`; all `components/design/*` consume `var(--…)`
  with almost no hardcoded brand colors. Swapping token values reskins the app.
- Current `:root` is a permanently-dark Giro palette (accent `#ff2e8e`). There is
  **no** theme-switching mechanism, no `[data-theme]`, no light mode.
- The active edition is fetched server-side via `getActiveEdition()`
  (`src/lib/queries/stages.ts`). The **root** `src/app/layout.tsx` renders
  `<html>` + fonts but does not currently read the edition (the nested
  `(app)/layout.tsx` does).
- Hardcoded Giro branding: `"GIRO · MMXXVI"` in `sign-in/page.tsx`,
  `onboarding/page.tsx`, `components/app-shell.tsx`; metadata `title: "Quiniela
  Giro"` and `theme-color: #0b0d10` in `layout.tsx`.
- A few components encode dark assumptions that a light theme surfaces:
  `bib-tile.tsx` hardcodes `background:#fff; color:#1a1714`; `jersey-glyph.tsx`
  uses `--jersey-pink` (points) and `--jersey-white` (youth).

## Architecture — theme selected by active edition (no DB change)

1. **Slug → theme mapping (pure function).** Add
   `themeForSlug(slug?: string | null): 'giro' | 'tour'` (e.g.
   `src/lib/theme/theme-for-slug.ts`): `tour-*` → `'tour'`, `giro-*` → `'giro'`,
   anything else / null → `'giro'` (safe default). Unit-tested.

2. **Themes as CSS custom-property sets** in `globals.css`:
   - `:root { … }` stays the **Giro dark** tokens (unchanged values).
   - Add `[data-theme="tour"] { … }` overriding the palette with the light Tour
     tokens (below). `[data-theme="giro"]` may be written explicitly too, but
     `:root` already is the Giro default.

3. **Apply at the root.** `src/app/layout.tsx` (server component) resolves the
   active edition (best-effort; failure or none → default) and sets
   `data-theme={themeForSlug(edition?.slug)}` on `<html>`. This flips `--bg`,
   `<body>`, and every `var(--…)` across the whole app, including the pre-auth
   `sign-in` / `onboarding` routes. Resolution is wrapped so a query error or
   logged-out state falls back to `'giro'` rather than throwing.

4. **Per-edition metadata.** Convert the static `metadata` export in `layout.tsx`
   to `generateMetadata()` deriving `title` and `theme-color` from the active
   edition (Tour → light `theme-color: #fbfbfb`, title "Quiniela Tour"; Giro →
   today's values). Same best-effort fallback.

## The two themes

### Giro (unchanged — current `:root` values)
Dark palette, pink accent `#ff2e8e`, etc. No value changes; only additions from
the token renames below (with Giro's existing values assigned).

### Tour de France (new, light) — `[data-theme="tour"]`
| token | value |
|---|---|
| `--bg` | `#fbfbfb` |
| `--surface` | `#ffffff` |
| `--surface-alt` | `#f2f2f2` |
| `--ink` | `#18181a` |
| `--ink-soft` | `#5c5c5c` |
| `--ink-mute` | `#8e8e8e` |
| `--hair` | `#e8e8e8` |
| `--accent` | `#ffff00` (`#ff0`) — highlight **fill** only |
| `--accent-ink` | `#1a1700` (near-black text on yellow) |
| `--accent-soft` | `#fff6bf` (secondary uses: hover, glows) |
| `--ok` | `#0f9d58` |
| `--warn` | `#b45309` |
| `--danger` | `#dc2626` |
| `--jersey-points` | `#15803d` (maillot vert) |
| `--jersey-youth` | `#ffffff` |
| `--bib-bg` | `#1a1a1a` |
| `--bib-ink` | `#ffffff` |

Usage rules baked into components/tokens:
- `#ff0` is a **fill** (buttons, logo, pills, the "You"/leader left bar). It is
  **never** used as text/link color on the light theme.
- **Text-accents are `--ink` (black)** — e.g. the GC position number, links.
  Links may use a `#ff0` underline for affordance.
- **"You"/leader row** = `--surface` (white) with a 4px solid `--accent` left bar
  and a subtle shadow (no pale-yellow fill).

### Token renames (both themes gain these)
- `--jersey-pink` → **`--jersey-points`**; `--jersey-white` → **`--jersey-youth`**.
  Giro assigns `--jersey-points: #9b1d4b`, `--jersey-youth: #f4f2ef`; Tour assigns
  the green/white above. Update `jersey-glyph.tsx` to consume the new names.
- Add `--bib-bg` / `--bib-ink`. Giro: `#ffffff` / `#1a1714` (today's look). Tour:
  `#1a1a1a` / `#ffffff`. Update `bib-tile.tsx` to consume them instead of
  hardcoded values.

## Component adjustments

- `components/design/bib-tile.tsx` — replace hardcoded `#fff`/`#1a1714` with
  `var(--bib-bg)` / `var(--bib-ink)`.
- `components/design/jersey-glyph.tsx` — consume `--jersey-points` /
  `--jersey-youth`.
- Sweep `components/design/*` for hardcoded dark values or shadows that look
  wrong on a light background (notably `live-dot`, `stage-profile`,
  `logo`); route any offenders through tokens or give them a light-appropriate
  value. No structural/component-API changes.
- Dynamic branding: replace the three hardcoded `"GIRO · MMXXVI"` strings with a
  computed label `"<RACE> · <ROMAN-YEAR>"`. `<RACE>` comes from a small map keyed
  by the theme key (`giro` → `"GIRO"`, `tour` → `"TOUR"`); `<ROMAN-YEAR>` is the
  year of `edition.start_date` in roman numerals (2026 → `MMXXVI`). Expose this
  as a helper (e.g. `editionLabel(edition)`) and thread it to `sign-in`,
  `onboarding`, and `app-shell`. Fallback when no edition: `"GIRO · MMXXVI"`.

## Testing

- Unit: `themeForSlug()` — `tour-de-france-2026` → `'tour'`, `giro-2026` →
  `'giro'`, `undefined`/unknown → `'giro'`.
- Visual pass in both themes across home, picks (list + GC + jerseys + stage),
  stage detail, leaderboard/board, me, admin, plus sign-in & onboarding. Confirm
  light-theme contrast (buttons, "You" row, bib, badges, jersey glyphs) and that
  the dark Giro theme is visually unchanged.
- Fallback: with no active edition / query failure, the app renders the default
  Giro dark theme and does not error.

## Out of scope (YAGNI)

- No `theme` column on `editions` (slug-derived).
- No per-edition font changes (fonts stay Space Grotesk / Inter Tight / JetBrains
  Mono for both themes).
- No new races beyond Giro/Tour; adding one later = a new `[data-theme]` block +
  a slug prefix in `themeForSlug`.
- No user-selectable theme toggle; theme strictly follows the active edition.
- KOM / polka-dot jersey is not modeled (the app has only points + youth picks).
