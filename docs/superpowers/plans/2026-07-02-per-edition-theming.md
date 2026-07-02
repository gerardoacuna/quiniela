# Per-edition Theming + Tour de France Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the app's visual theme automatically based on the active race edition, adding a light Tour de France theme (`#ff0` highlight) while the Giro keeps today's dark theme.

**Architecture:** Themes are CSS custom-property sets in `globals.css` (`:root` = Giro dark, `[data-theme="tour"]` = Tour light). A pure `themeForSlug()` maps the active edition's slug → theme key; the root `layout.tsx` resolves the active edition and sets `data-theme` on `<html>`, so every `var(--…)` flips app-wide (incl. pre-auth pages). Branding text and metadata derive from the active edition. Components are already token-first; a light theme requires routing accent-as-text and the "You"-row highlight through new semantic tokens so the Giro stays pixel-identical.

**Tech Stack:** Next.js (App Router, RSC + `next/font`), React context, plain CSS custom properties (+ Tailwind v4 / shadcn mappings that inherit via `var()`), Vitest.

## Global Constraints

- Theme is **slug-derived, no DB change**: `tour-*` → `tour`, else → `giro` (default/fallback).
- `#ff0` (`--accent`) is a **fill only** on the light theme; text-accents use `--accent-text` (ink/black on Tour, pink on Giro). `#ff0` text/links are never used on light.
- Giro theme must stay **visually unchanged** — new tokens take Giro's current values.
- Tour tokens (verbatim): `--bg #fbfbfb` · `--surface #ffffff` · `--surface-alt #f2f2f2` · `--ink #18181a` · `--ink-soft #5c5c5c` · `--ink-mute #8e8e8e` · `--hair #e8e8e8` · `--accent #ffff00` · `--accent-ink #1a1700` · `--accent-soft #fff6bf` · `--ok #0f9d58` · `--warn #b45309` · `--danger #dc2626` · `--jersey-points #15803d` · `--jersey-youth #ffffff` · `--bib-bg #1a1a1a` · `--bib-ink #ffffff`.
- Branding label: `"<RACE> · <ROMAN-YEAR>"`, RACE = `GIRO`/`TDF` by theme key, year from `edition.start_date`. Fallback `"GIRO · MMXXVI"`.
- Token renames (both themes): `--jersey-pink`→`--jersey-points`, `--jersey-white`→`--jersey-youth`. New tokens: `--bib-bg`, `--bib-ink`, `--accent-text`, `--row-you-bg`, `--row-you-bar`.
- Theme resolution is **best-effort**: any error / no active edition → Giro dark, never throws.
- Dependencies installed; do not install. Local `npx supabase db reset` + `docker exec supabase_db_quiniela psql …` available (OrbStack). Local seed has the **Giro active** (so the default theme is exercised locally); to preview the Tour theme, temporarily activate the Tour edition locally (a psql `UPDATE`), then revert.

---

### Task 1: Theme + label helpers (pure, TDD)

**Files:**
- Create: `src/lib/theme/theme-for-slug.ts`
- Create: `src/lib/theme/edition-label.ts`
- Test: `src/lib/theme/theme-for-slug.test.ts`
- Test: `src/lib/theme/edition-label.test.ts`

**Interfaces:**
- Produces: `type ThemeKey = 'giro' | 'tour'`; `themeForSlug(slug?: string | null): ThemeKey`; `editionLabel(edition: { slug: string; start_date: string } | null | undefined): string`.

- [ ] **Step 1: Write failing tests**

`src/lib/theme/theme-for-slug.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { themeForSlug } from './theme-for-slug';

describe('themeForSlug', () => {
  it('maps tour slugs to tour', () => {
    expect(themeForSlug('tour-de-france-2026')).toBe('tour');
  });
  it('maps giro slugs to giro', () => {
    expect(themeForSlug('giro-2026')).toBe('giro');
  });
  it('falls back to giro for unknown, empty, null, undefined', () => {
    expect(themeForSlug('vuelta-2026')).toBe('giro');
    expect(themeForSlug('')).toBe('giro');
    expect(themeForSlug(null)).toBe('giro');
    expect(themeForSlug(undefined)).toBe('giro');
  });
});
```

`src/lib/theme/edition-label.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { editionLabel } from './edition-label';

describe('editionLabel', () => {
  it('labels the Tour as TDF with the roman year', () => {
    expect(editionLabel({ slug: 'tour-de-france-2026', start_date: '2026-07-04' })).toBe('TDF · MMXXVI');
  });
  it('labels the Giro as GIRO with the roman year', () => {
    expect(editionLabel({ slug: 'giro-2026', start_date: '2026-05-09' })).toBe('GIRO · MMXXVI');
  });
  it('falls back to GIRO · MMXXVI when no edition', () => {
    expect(editionLabel(null)).toBe('GIRO · MMXXVI');
    expect(editionLabel(undefined)).toBe('GIRO · MMXXVI');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/theme/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `theme-for-slug.ts`**

```ts
export type ThemeKey = 'giro' | 'tour';

export function themeForSlug(slug?: string | null): ThemeKey {
  if (slug && slug.startsWith('tour')) return 'tour';
  return 'giro';
}
```

- [ ] **Step 4: Implement `edition-label.ts`**

```ts
import { themeForSlug, type ThemeKey } from './theme-for-slug';

const RACE_WORD: Record<ThemeKey, string> = { giro: 'GIRO', tour: 'TDF' };

function toRoman(year: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = year;
  let out = '';
  for (const [value, sym] of table) {
    while (n >= value) { out += sym; n -= value; }
  }
  return out;
}

export function editionLabel(
  edition: { slug: string; start_date: string } | null | undefined,
): string {
  if (!edition) return 'GIRO · MMXXVI';
  const word = RACE_WORD[themeForSlug(edition.slug)];
  const year = new Date(edition.start_date).getUTCFullYear();
  return `${word} · ${toRoman(year)}`;
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/lib/theme/`
Expected: PASS (all cases; note `toRoman(2026)` = `MMXXVI`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme/theme-for-slug.ts src/lib/theme/edition-label.ts src/lib/theme/theme-for-slug.test.ts src/lib/theme/edition-label.test.ts
git commit -m "feat(theme): slug->theme mapping and edition branding label helpers"
```

---

### Task 2: Theme tokens in globals.css + token-driven bib/jersey

**Files:**
- Modify: `src/app/globals.css` (`:root` block lines ~51–68; add a `[data-theme="tour"]` block after `:root` closes at line ~109)
- Modify: `src/components/design/bib-tile.tsx`
- Modify: `src/components/design/jersey-glyph.tsx`

**Interfaces:**
- Produces: full Giro (`:root`) + Tour (`[data-theme="tour"]`) token sets, including `--jersey-points`, `--jersey-youth`, `--bib-bg`, `--bib-ink`, `--accent-text`, `--row-you-bg`, `--row-you-bar`. `JerseyGlyph` and `BibTile` consume these tokens.

- [ ] **Step 1: Update `:root` (Giro) tokens — rename + add**

In `src/app/globals.css`, replace the two jersey lines (currently `--jersey-pink: #9b1d4b;` and `--jersey-white: #f4f2ef;`) and add the new semantic tokens, so this block reads:

```css
  --jersey-points: #9b1d4b;
  --jersey-youth: #f4f2ef;
  --bib-bg: #ffffff;
  --bib-ink: #1a1714;
  --accent-text: var(--accent);
  --row-you-bg: var(--accent-soft);
  --row-you-bar: var(--accent-soft);
```
(Place these inside `:root`, e.g. right after the `--danger` line. `--accent-text`/`--row-you-bar` intentionally equal existing Giro colors so the dark theme is unchanged — the `--row-you-bar` matches `--row-you-bg` so no visible bar appears on Giro.)

- [ ] **Step 2: Add the Tour theme block**

Immediately after the `:root { … }` block closes (≈ line 109), add:

```css
[data-theme="tour"] {
  --bg: #fbfbfb;
  --surface: #ffffff;
  --surface-alt: #f2f2f2;
  --ink: #18181a;
  --ink-soft: #5c5c5c;
  --ink-mute: #8e8e8e;
  --hair: #e8e8e8;
  --accent: #ffff00;
  --accent-ink: #1a1700;
  --accent-soft: #fff6bf;
  --ok: #0f9d58;
  --warn: #b45309;
  --danger: #dc2626;
  --jersey-points: #15803d;
  --jersey-youth: #ffffff;
  --bib-bg: #1a1a1a;
  --bib-ink: #ffffff;
  --accent-text: var(--ink);   /* #ff0 is fill-only; text-accents are ink/black */
  --row-you-bg: var(--surface); /* white row, highlight is the bar only */
  --row-you-bar: var(--accent); /* solid #ff0 left bar */
  --chart-5: #ffff00;
}
```
(The shadcn mappings and other tokens in `:root` reference these via `var()`, so they inherit the overrides automatically — do not duplicate them.)

- [ ] **Step 3: Make `bib-tile.tsx` token-driven**

In `src/components/design/bib-tile.tsx`, replace the hardcoded colors:
```tsx
        background: 'var(--bib-bg)', color: 'var(--bib-ink)',
```
(was `background: '#fff', color: '#1a1714',`). Leave the rest unchanged.

- [ ] **Step 4: Make `jersey-glyph.tsx` token-driven**

In `src/components/design/jersey-glyph.tsx`, replace the background line:
```tsx
  const background = kind === 'white' ? 'var(--jersey-youth)' : 'var(--jersey-points)';
```
(was `'var(--jersey-white)' : 'var(--jersey-pink)'`).

- [ ] **Step 5: Verify no stale token references remain + build**

Run: `grep -rn "jersey-pink\|jersey-white" src/` → Expected: no matches.
Run: `npx tsc --noEmit` → Expected: clean.
Run: `npm run build` → Expected: succeeds (Tailwind/shadcn parse `globals.css`).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/design/bib-tile.tsx src/components/design/jersey-glyph.tsx
git commit -m "feat(theme): add Tour light theme tokens + route bib/jersey through tokens"
```

---

### Task 3: Apply theme at the root layout + per-edition metadata + label context

**Files:**
- Modify: `src/lib/queries/stages.ts` (wrap `getActiveEdition` in `cache()`)
- Create: `src/lib/theme/edition-theme-context.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `themeForSlug`, `editionLabel` (Task 1); `getActiveEdition`.
- Produces: `<EditionThemeProvider label={string}>` (client) and `useEditionLabel(): string`; `<html data-theme={ThemeKey}>`; per-theme `<title>` + `theme-color`.

- [ ] **Step 1: Dedupe `getActiveEdition` with React `cache()`**

In `src/lib/queries/stages.ts`, wrap the function so multiple calls per request hit the DB once. Replace the `export async function getActiveEdition(...)` with:
```ts
import { cache } from 'react';
// ...
export const getActiveEdition = cache(async (): Promise<EditionRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
});
```
(Behavior is unchanged for existing callers; it still throws on error.)

- [ ] **Step 2: Create the label context**

`src/lib/theme/edition-theme-context.tsx`:
```tsx
'use client';
import { createContext, useContext, type ReactNode } from 'react';

const EditionLabelContext = createContext<string>('GIRO · MMXXVI');

export function EditionThemeProvider({ label, children }: { label: string; children: ReactNode }) {
  return <EditionLabelContext.Provider value={label}>{children}</EditionLabelContext.Provider>;
}

export function useEditionLabel(): string {
  return useContext(EditionLabelContext);
}
```

- [ ] **Step 3: Update the root layout**

Rewrite `src/app/layout.tsx` to resolve the edition (best-effort), set `data-theme`, provide the label, and derive metadata/viewport per theme. Keep the font setup as-is. The full file:

```tsx
import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getActiveEdition } from "@/lib/queries/stages";
import { themeForSlug } from "@/lib/theme/theme-for-slug";
import { editionLabel } from "@/lib/theme/edition-label";
import { EditionThemeProvider } from "@/lib/theme/edition-theme-context";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400", "500", "600", "700"] });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-body", display: "swap", weight: ["400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500", "600", "700"] });

async function resolveEdition() {
  try { return await getActiveEdition(); } catch { return null; }
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = themeForSlug((await resolveEdition())?.slug);
  return {
    title: theme === "tour" ? "Quiniela TDF" : "Quiniela Giro",
    description: "Grand tour pickem",
    manifest: "/manifest.webmanifest",
    icons: { apple: "/apple-touch-icon.png" },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Quiniela" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = themeForSlug((await resolveEdition())?.slug);
  return {
    themeColor: theme === "tour" ? "#fbfbfb" : "#0b0d10",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const edition = await resolveEdition();
  const theme = themeForSlug(edition?.slug);
  const label = editionLabel(edition);
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${spaceGrotesk.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased bg-background text-foreground">
        <EditionThemeProvider label={label}>{children}</EditionThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build + default theme**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → succeeds.
Run the app against local (Giro active): `npm run dev`, load `/`, and confirm `<html data-theme="giro">` in the DOM and the dark theme is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/stages.ts src/lib/theme/edition-theme-context.tsx src/app/layout.tsx
git commit -m "feat(theme): set data-theme + per-edition metadata/label from active edition"
```

---

### Task 4: Dynamic branding label (remove hardcoded "GIRO · MMXXVI")

**Files:**
- Modify: `src/components/app-shell.tsx` (client — line ~57)
- Modify: `src/app/sign-in/page.tsx` (client — line ~93)
- Modify: `src/app/onboarding/page.tsx` (server — line ~82)

**Interfaces:**
- Consumes: `useEditionLabel()` (Task 3, client); `editionLabel` + `getActiveEdition` (server).

- [ ] **Step 1: `app-shell.tsx` — use the label hook**

Add the import at the top of `src/components/app-shell.tsx`:
```tsx
import { useEditionLabel } from '@/lib/theme/edition-theme-context';
```
Inside the `AppShell` component body (it's already `'use client'`), add near the top:
```tsx
  const editionLabelText = useEditionLabel();
```
Replace the hardcoded label content (`>GIRO · MMXXVI<`) so the span renders `{editionLabelText}`.

- [ ] **Step 2: `sign-in/page.tsx` — use the label hook**

Add the import to `src/app/sign-in/page.tsx`:
```tsx
import { useEditionLabel } from '@/lib/theme/edition-theme-context';
```
Add `const editionLabelText = useEditionLabel();` inside the component, and replace the `GIRO · MMXXVI` text node with `{editionLabelText}`.

- [ ] **Step 3: `onboarding/page.tsx` — compute directly (server)**

In `src/app/onboarding/page.tsx` (an `async` server component), add imports:
```tsx
import { getActiveEdition } from '@/lib/queries/stages';
import { editionLabel } from '@/lib/theme/edition-label';
```
At the top of the component body compute:
```tsx
  const editionLabelText = editionLabel(await getActiveEdition().catch(() => null));
```
Replace the `GIRO · MMXXVI` text node with `{editionLabelText}`.

- [ ] **Step 4: Verify no hardcoded labels remain + build**

Run: `grep -rn "GIRO · MMXXVI" src/` → Expected: no matches.
Run: `npx tsc --noEmit` → clean. `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell.tsx src/app/sign-in/page.tsx src/app/onboarding/page.tsx
git commit -m "feat(theme): derive edition branding label from active edition"
```

---

### Task 5: Light-theme contrast sweep (accent-as-text + You-row highlight)

**Files (modify):**
- `src/app/(app)/home/top-five-card.tsx` (lines ~14, ~20)
- `src/app/(app)/home/standing-card.tsx` (line ~97)
- `src/app/(app)/board/client.tsx` (lines ~83, ~91)
- `src/app/(app)/board/everyones-gc.tsx` (line ~157)
- `src/app/(app)/board/everyones-jerseys.tsx` (line ~156)
- `src/app/(app)/stage/[stageNumber]/participants-card.tsx` (lines ~83, ~92)

**Interfaces:**
- Consumes: `--accent-text`, `--row-you-bg`, `--row-you-bar` (Task 2).
- Rationale: on the light theme `--accent` (`#ff0`) is invisible as text, and the "You" row must be white + `#ff0` bar (not a pale-yellow fill). These map cleanly to the new tokens with zero visual change on Giro.

**Two mechanical transforms, applied at the cited lines:**

- [ ] **Step 1: Accent-as-text → `--accent-text`**

Anywhere a text/foreground `color` is `var(--accent)` for the current user, change it to `var(--accent-text)`:
- `top-five-card.tsx` ~line 20: `color: isMe ? 'var(--accent-text)' : 'var(--ink-soft)',`
- `board/client.tsx` ~line 91: `color: isMe ? "var(--accent-text)" : "var(--ink-soft)",`
- `participants-card.tsx` ~line 92: `color: isMe ? 'var(--accent-text)' : 'var(--ink)',`

Leave `background: var(--accent)` fills as-is (e.g. `board/client.tsx` ~line 124 is a fill — `#ff0` fill is fine on light).

- [ ] **Step 2: "You"-row highlight → row tokens**

For each isMe/self row that currently sets `background: isMe ? 'var(--accent-soft)' : 'transparent'`, change it to use the row tokens and add an alignment-safe left bar:
```tsx
background: isMe ? 'var(--row-you-bg)' : 'transparent',
borderLeft: `3px solid ${isMe ? 'var(--row-you-bar)' : 'transparent'}`,
```
Apply at: `top-five-card.tsx` ~line 14; `board/client.tsx` ~line 83; `everyones-gc.tsx` ~line 157; `everyones-jerseys.tsx` ~line 156; `participants-card.tsx` ~line 83.

For `standing-card.tsx` ~line 97 (unconditional `background: 'var(--accent-soft)'`, the user's own standing card): change to
```tsx
background: 'var(--row-you-bg)',
borderLeft: '3px solid var(--row-you-bar)',
```

(On Giro these tokens equal `--accent-soft`, and `--row-you-bar` == `--row-you-bg`, so the bar is invisible and the rows look unchanged aside from a uniform 3px inset. On Tour: white row + solid `#ff0` bar.)

Do NOT change the other `--accent-soft` uses (nav active state, `rider-row` selected, `badge` "soft" tone, `live-dot` glow, `stage-profile` soft) — pale yellow reads fine there on light.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean. `npm run build` → succeeds.
Run: `grep -rn "isMe ? 'var(--accent)'" src/ ; grep -rn "isMe ? \"var(--accent)\"" src/` → Expected: no remaining accent-as-**text** for isMe (only fills, if any, remain intentionally).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/home/top-five-card.tsx" "src/app/(app)/home/standing-card.tsx" "src/app/(app)/board/client.tsx" "src/app/(app)/board/everyones-gc.tsx" "src/app/(app)/board/everyones-jerseys.tsx" "src/app/(app)/stage/[stageNumber]/participants-card.tsx"
git commit -m "feat(theme): route accent-as-text and You-row highlight through theme tokens"
```

---

### Task 6: Verification sweep (both themes)

**Files:** none (verification only)

- [ ] **Step 1: Static checks**

Run: `npx vitest run` → all unit tests pass (incl. Task 1 theme helpers).
Run: `npx tsc --noEmit` → clean.
Run: `npm run lint` → clean (or no new violations in touched files).
Run: `npm run build` → succeeds.

- [ ] **Step 2: Visual pass — Giro (default, dark)**

`npm run dev` against local (Giro active). Confirm `<html data-theme="giro">`, dark theme unchanged across `/home`, `/picks` (list + GC + jerseys + a stage), `/board`, `/me`, `/sign-in`, `/onboarding`. Branding label reads `GIRO · MMXXVI`.

- [ ] **Step 3: Visual pass — Tour (light)**

Temporarily activate the Tour locally, then revert:
```bash
docker exec supabase_db_quiniela psql -U postgres -d postgres -c "begin; update editions set is_active=false where is_active=true; update editions set is_active=true where slug='tour-de-france-2026'; commit;"
```
Reload the app. Confirm `<html data-theme="tour">`, light theme app-wide, and specifically: buttons/logo/pills are `#ff0` with dark text; text-accents (position numbers, "You" name) are readable (ink, not yellow); the "You"/leader row is white with a solid `#ff0` left bar; the bib chip is dark; Points jersey = green, Youth = white; badges/countdown/live-dot legible; sign-in & onboarding light; label reads `TDF · MMXXVI`.
Then revert local state: `npx supabase db reset` (returns to Giro-active).

- [ ] **Step 4: Confirm scope**

Run: `git diff --name-only main..HEAD` → only `src/lib/theme/*`, `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/queries/stages.ts`, the branding + sweep components, and this plan/spec. No migrations, no DB schema changes.

---

## Self-Review

**Spec coverage:**
- Slug-derived theme selection, default giro → Task 1 (`themeForSlug`) + Task 3 (root layout). ✓
- `[data-theme="tour"]` + `:root` giro token sets, exact Tour values → Task 2. ✓
- data-theme on `<html>` from active edition; per-edition metadata/theme-color → Task 3. ✓
- Token renames + `--bib-*` + component updates → Task 2. ✓
- `#ff0` fill-only / text-accents ink (`--accent-text`); You-row white+bar (`--row-you-*`) → Tasks 2 + 5. ✓
- Dynamic `TDF · MMXXVI` label across 3 spots → Tasks 3 (context) + 4. ✓
- Best-effort fallback to giro → Task 3 (`resolveEdition` try/catch, `editionLabel` null-guard). ✓
- Testing both themes → Task 6. ✓
- No DB change / no font change / no theme toggle → honored (Task 6 Step 4 confirms). ✓

**Placeholder scan:** No TBD/TODO; every code step has concrete code or exact grep/commands. The Task 5 sweep gives the exact transform + every file:line.

**Type/name consistency:** `ThemeKey`, `themeForSlug`, `editionLabel`, `EditionThemeProvider`/`useEditionLabel`, and the token names (`--accent-text`, `--row-you-bg`, `--row-you-bar`, `--jersey-points`, `--jersey-youth`, `--bib-bg`, `--bib-ink`) are identical across the tasks that define and consume them.

**Note (verified during planning):** CSS uses `[data-theme="tour"]` overriding base tokens; shadcn/chart/sidebar mappings in `:root` reference base tokens via `var()` and inherit automatically — no duplication needed. Line numbers are approximate; match on the quoted code.
