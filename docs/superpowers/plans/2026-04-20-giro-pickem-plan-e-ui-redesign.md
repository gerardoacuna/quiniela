# Plan E — Player UI Redesign (Experimental direction) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the entire player-facing UI with the "Experimental" direction from the Claude Design prototype — dark broadcast canvas, Space Grotesk display, JetBrains Mono numerics, hot-pink accent, sharp 2px radii. Admin UI untouched.

**Architecture:** Port the prototype's atoms (BibTile, TeamChip, RiderRow, StageProfile, TerrainGlyph, Countdown, LiveDot, Badge, Card, SectionTitle, etc.) into `src/components/design/` as typed React 19 components consuming CSS variables from `globals.css`. All player routes rewrite to use these atoms. Keep existing server actions, queries, RLS, scoring. Add `terrain` + `km` columns to `stages` so the design's context chips have real data.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · CSS custom properties for theme tokens · next/font for Space Grotesk + Inter Tight + JetBrains Mono.

## Reference material

- Full prototype bundle extracted at `/tmp/design-extract/quiniela/` on the worker's machine. Primary file: `project/Quiniela Prototype.html`. Atoms: `project/atoms.jsx`. Screens: `project/screens.jsx` (1534 lines). Fake data: `project/data.js`.
- Chat transcript at `chats/chat1.md` explaining intent.
- Experimental theme tokens live in `atoms.jsx:60-82` — copy these values verbatim into our CSS vars.

## Scope

**In scope:**
- Home, Picks index, Stage pick, Stage detail, GC picker, Jersey picker, Board, Me screens
- New atoms library under `src/components/design/`
- Schema additions: `stages.terrain` enum + `stages.km` int
- Admin edit UI for the two new columns (minimal — inline in existing edition page)
- Design tokens in `globals.css` + font loading in `layout.tsx`
- PWA manifest + icons re-tinted to the experimental palette
- E2E selector updates where they rely on old markup

**Out of scope:**
- Admin pages beyond the terrain/km inputs
- Safe + Bold variants — Experimental only
- Tweaks panel (prototype-only)
- FormBar rider-form indicator (the schema has no `form` column; omit it)
- Data model changes beyond terrain/km
- RLS, scoring, cron, any server-side work

## File inventory

**Create:**
- `src/components/design/tokens.ts` — typed access to CSS vars
- `src/components/design/badge.tsx`
- `src/components/design/bib-tile.tsx`
- `src/components/design/button.tsx` (design-system button; shadcn Button kept for admin)
- `src/components/design/card.tsx`
- `src/components/design/countdown.tsx`
- `src/components/design/live-dot.tsx`
- `src/components/design/logo.tsx`
- `src/components/design/rider-row.tsx`
- `src/components/design/section-title.tsx`
- `src/components/design/stage-profile.tsx`
- `src/components/design/team-chip.tsx`
- `src/components/design/terrain-glyph.tsx`
- `src/components/design/time.ts` — `untilText`, `untilParts`, `ordinal`, `fmtDate`, `fmtTime` helpers
- `src/components/design/teams.ts` — static team-color lookup by text match
- `src/components/app-shell.tsx` — TopBar + SideNav/BottomTabs wrapper (replaces `(app)/layout.tsx` body)
- `src/components/stage-timeline.tsx` — swipeable 21-stage strip for Home
- `src/app/(app)/picks/gc/form.tsx` — client component for GC picker (if not already split)
- `src/app/(app)/picks/jersey/form.tsx` — same for Jersey
- Migration: `supabase/migrations/20260420000001_stage_terrain_km.sql`

**Modify:**
- `src/app/layout.tsx` — font loading, meta theme-color `#0b0d10`
- `src/app/globals.css` — experimental palette, font variables, radii
- `src/app/(app)/layout.tsx` — use new AppShell
- `src/app/(app)/home/page.tsx` — new Home layout
- `src/app/(app)/picks/page.tsx` — new Picks index
- `src/app/(app)/picks/stage/[stageNumber]/{page,form}.tsx` — new stage picker UX
- `src/app/(app)/stage/[stageNumber]/page.tsx` — new stage detail
- `src/app/(app)/picks/gc/page.tsx` — new GC UX
- `src/app/(app)/picks/jersey/page.tsx` — new Jersey UX
- `src/app/(app)/board/page.tsx` — new Board
- `src/app/(app)/me/page.tsx` — new Me
- `src/components/rider-picker.tsx` — restyle to match `RiderRow` atom (keep existing API)
- `src/components/bottom-tabs.tsx` — retire (superseded by app-shell)
- `src/components/countdown-badge.tsx` — retire (superseded by Countdown atom)
- `src/lib/queries/stages.ts` — surface `terrain` + `km` from the DB
- `src/lib/queries/riders.ts` — return team name so UI can resolve color
- `src/lib/types/database.ts` — regenerated after migration
- `src/lib/actions/admin-edition.ts` — extend schema to accept `terrain` + `km`
- `src/app/admin/edition/form.tsx` — add terrain select + km input per stage
- `supabase/seed.sql` — give the 3 seed stages terrain + km values
- `public/manifest.webmanifest` — `theme_color` + `background_color` to `#0b0d10`
- `public/icon-*.png`, `public/apple-touch-icon.png` — regenerate dark/pink
- `e2e/player-pick.spec.ts`, `e2e/admin-publish.spec.ts` — update selectors

**Delete:**
- `src/components/bottom-tabs.tsx` (after app-shell lands)
- `src/components/countdown-badge.tsx` (after Countdown atom lands)

## Experimental theme tokens (authoritative)

Copy these into `globals.css` `@layer base` under `:root` (and a `.dark` variant if the shadcn Tailwind config needs it; otherwise apply globally since the whole app is now dark):

| Token | Value |
|---|---|
| `--bg` | `#0b0d10` |
| `--surface` | `#12151a` |
| `--surface-alt` | `#181c22` |
| `--ink` | `#f4f2ef` |
| `--ink-soft` | `#b8b4ad` |
| `--ink-mute` | `#6f6c65` |
| `--hair` | `#262a31` |
| `--accent` | `#ff2e8e` |
| `--accent-ink` | `#0b0d10` |
| `--accent-soft` | `#2a1422` |
| `--ok` | `#3ee9a7` |
| `--warn` | `#ffb454` |
| `--danger` | `#ff4d6d` |
| `--radius` | `2px` |
| `--font-display` | `"Space Grotesk", "Inter Tight", ui-sans-serif, system-ui, sans-serif` |
| `--font-body` | `"Inter Tight", ui-sans-serif, system-ui, sans-serif` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace` |
| `--display-weight` | `600` |

## Execution order

Phases ship independently — each phase is one PR-sized chunk. After every phase: typecheck + lint + unit + integration + E2E must stay green before the next phase starts. Per-task commits are the norm.

**Sequence:**
- **Phase 1** — Schema: migrate `terrain` + `km`, regenerate types, backfill seed, extend admin form. No UI redesign yet.
- **Phase 2** — Design tokens + fonts + admin stays on current look (admin doesn't care; player routes will flip in later phases).
- **Phase 3** — Design atoms (BibTile, TeamChip, etc.) — shipped standalone, not yet wired anywhere.
- **Phase 4** — App shell (TopBar + BottomTabs/SideNav).
- **Phase 5** — Home screen.
- **Phase 6** — Picks index + stage picker.
- **Phase 7** — Stage detail.
- **Phase 8** — GC + Jersey pickers.
- **Phase 9** — Board + Me.
- **Phase 10** — PWA brand refresh + E2E selector updates + final sanity.
- **Phase 11** — Delete retired components, final code review.

---

## Phase 1 — Schema: terrain + km

### Task E-1.1: Migration + enum

**Files:**
- Create: `supabase/migrations/20260420000001_stage_terrain_km.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write migration**

```sql
-- Add terrain enum + km column for stage UX context.
create type public.stage_terrain as enum ('flat', 'hilly', 'mountain', 'itt');

alter table public.stages
  add column terrain public.stage_terrain not null default 'flat',
  add column km integer not null default 0 check (km >= 0 and km <= 400);

comment on column public.stages.terrain is 'Course profile category used in player UI';
comment on column public.stages.km is 'Stage length in kilometres';
```

- [ ] **Step 2: Backfill seed**

Edit `supabase/seed.sql` — the three `insert into public.stages` rows. Add `terrain` and `km` columns:

Change the stages insert to:

```sql
insert into public.stages (id, edition_id, number, start_time, counts_for_scoring, double_points, status, terrain, km) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 1,  '2026-05-09 12:00:00+00', true,  false, 'upcoming', 'flat',     197),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 9,  '2026-05-17 12:00:00+00', true,  true,  'upcoming', 'mountain', 171),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 21, '2026-05-31 12:00:00+00', true,  false, 'upcoming', 'itt',       28);
```

- [ ] **Step 3: Apply + regenerate types**

```bash
npx supabase db reset
npm run db:types
```

- [ ] **Step 4: Verify**

```bash
npx vitest run --reporter=dot
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/ --reporter=dot
```

All green (no UI uses the new columns yet; existing queries just see extra fields they ignore).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260420000001_stage_terrain_km.sql supabase/seed.sql src/lib/types/database.ts
git commit -m "feat(db): add stages.terrain enum + stages.km for redesign UX"
```

### Task E-1.2: Expose terrain + km to UI queries

**Files:**
- Modify: `src/lib/queries/stages.ts`
- Modify: `src/lib/actions/admin-edition.ts`
- Modify: `src/app/admin/edition/form.tsx`

- [ ] **Step 1: Queries select new columns**

In `src/lib/queries/stages.ts`, any `select('id, edition_id, number, start_time, ...')` statement must add `, terrain, km`. Search with:

```bash
grep -n "start_time" src/lib/queries/stages.ts
```

Expand every select list accordingly. The Row type is already regenerated in `database.ts`.

- [ ] **Step 2: Extend admin edition action**

In `src/lib/actions/admin-edition.ts`, the Zod schema for the stage-flags form should accept `terrain` and `km`. Find the current `updateStageFlags` (or equivalent) schema and add:

```ts
const stageEditSchema = z.object({
  stageId: z.string().uuid(),
  counts_for_scoring: z.boolean(),
  double_points: z.boolean(),
  terrain: z.enum(['flat', 'hilly', 'mountain', 'itt']),
  km: z.number().int().min(0).max(400),
});
```

Update the action body to include terrain + km in the `.update({ ... })` call.

- [ ] **Step 3: Extend admin edition form**

In `src/app/admin/edition/form.tsx`, add a terrain `<select>` and a km `<input type="number">` per stage row. Keep the current form shape minimal — no fancy validation UI. The form should render the existing counts_for_scoring + double_points checkboxes alongside the two new fields.

- [ ] **Step 4: Verify**

```bash
npm run typecheck && npm run lint
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/ --reporter=dot
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/stages.ts src/lib/actions/admin-edition.ts src/app/admin/edition/form.tsx
git commit -m "feat(admin): edit stage terrain + km alongside existing flags"
```

---

## Phase 2 — Design tokens + fonts

### Task E-2.1: Font loading

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Load Space Grotesk, Inter Tight, JetBrains Mono via next/font**

At the top of `src/app/layout.tsx`:

```ts
import { Space_Grotesk, Inter_Tight, JetBrains_Mono } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['400','500','600','700'] });
const interTight   = Inter_Tight({ subsets: ['latin'], variable: '--font-body', display: 'swap', weight: ['400','500','600','700'] });
const jetbrains    = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap', weight: ['400','500','600','700'] });
```

Attach variables to `<html>` className: `${spaceGrotesk.variable} ${interTight.variable} ${jetbrains.variable}`.

- [ ] **Step 2: Meta theme-color**

In the exported `viewport` object, change `themeColor` from `'#020617'` to `'#0b0d10'` (experimental bg).

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Warnings about unused fonts are fine until Phase 3 consumes them.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(design): load Space Grotesk, Inter Tight, JetBrains Mono via next/font"
```

### Task E-2.2: Global tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the existing tokens block with experimental palette**

Read `src/app/globals.css`. Locate the current `:root` block that sets `--background`, `--foreground`, etc. Replace with:

```css
@layer base {
  :root {
    --bg: #0b0d10;
    --surface: #12151a;
    --surface-alt: #181c22;
    --ink: #f4f2ef;
    --ink-soft: #b8b4ad;
    --ink-mute: #6f6c65;
    --hair: #262a31;
    --accent: #ff2e8e;
    --accent-ink: #0b0d10;
    --accent-soft: #2a1422;
    --ok: #3ee9a7;
    --warn: #ffb454;
    --danger: #ff4d6d;
    --radius: 2px;
    --display-weight: 600;
    --display-italic: normal;
  }

  html, body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-body), system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  ::-webkit-scrollbar { height: 6px; width: 6px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
}

@keyframes qpulse {
  0% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  100% { box-shadow: 0 0 0 8px transparent; opacity: 0.6; }
}

@keyframes qfadein {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.qfade { animation: qfadein 260ms ease-out both; }
```

If shadcn-compatible `--background` / `--foreground` tokens are still required by any of our admin components, **keep them** — map them to `var(--bg)` / `var(--ink)` for consistency. Don't delete any token admin code imports from.

- [ ] **Step 2: Verify admin pages still render**

Start dev (`npm run dev`), sign in as admin, visit `/admin/edition`. Admin should look identical-ish — admin was never pinned to a specific palette, so darkening the background is acceptable. If something reads unreadable, patch the admin component rather than reverting the token change.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): apply experimental palette tokens site-wide"
```

---

## Phase 3 — Design atoms

### Task E-3.1: `teams.ts` static lookup + `time.ts` helpers

**Files:**
- Create: `src/components/design/teams.ts`
- Create: `src/components/design/time.ts`

- [ ] **Step 1: Team color lookup**

Write `src/components/design/teams.ts`:

```ts
export type TeamColors = { name: string; color: string; accent: string };

// Name-substring → colors. UCI-style. The match is case-insensitive against
// `riders.team`, longest-match-wins. Teams not here fall back to a neutral.
const ENTRIES: Array<[RegExp, TeamColors]> = [
  [/uae/i,                        { name: 'UAE Team Emirates',     color: '#000000', accent: '#d52b1e' }],
  [/jumbo|visma/i,                { name: 'Jumbo-Visma',           color: '#fff100', accent: '#000000' }],
  [/ineos/i,                      { name: 'Ineos Grenadiers',      color: '#0a2240', accent: '#e20613' }],
  [/soudal|quick.?step/i,         { name: 'Soudal Quick-Step',     color: '#002e5f', accent: '#60ace5' }],
  [/lidl|trek/i,                  { name: 'Lidl-Trek',             color: '#e31b23', accent: '#ffffff' }],
  [/movistar/i,                   { name: 'Movistar Team',         color: '#005baa', accent: '#9cc84b' }],
  [/bora|red.?bull/i,             { name: 'Bora Hansgrohe',        color: '#1f2937', accent: '#b91c1c' }],
  [/dsm/i,                        { name: 'Team DSM',              color: '#0c1d2b', accent: '#ff5a00' }],
  [/ef\b|education/i,             { name: 'EF Education',          color: '#ff3d7f', accent: '#202a44' }],
  [/astana/i,                     { name: 'Astana Qazaqstan',      color: '#00a0e6', accent: '#f7e017' }],
  [/israel/i,                     { name: 'Israel-Premier Tech',   color: '#1a3a6d', accent: '#c62128' }],
  [/cofidis/i,                    { name: 'Cofidis',               color: '#d31145', accent: '#ffffff' }],
];

const FALLBACK: TeamColors = { name: 'Independent', color: '#3a3f47', accent: '#9aa0a8' };

export function resolveTeam(text: string | null | undefined): TeamColors {
  if (!text) return FALLBACK;
  for (const [pattern, colors] of ENTRIES) if (pattern.test(text)) return { ...colors, name: text };
  return { ...FALLBACK, name: text };
}
```

- [ ] **Step 2: Time helpers**

Write `src/components/design/time.ts`:

```ts
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
export function untilText(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'Locked';
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / (60 * 24));
  const h = Math.floor((m % (60 * 24)) / 60);
  const mm = m % 60;
  if (d >= 1) return `${d}d ${h}h`;
  if (h >= 1) return `${h}h ${mm}m`;
  return `${mm}m`;
}
export interface UntilParts { d: number; h: number; m: number; s: number; locked: boolean }
export function untilParts(iso: string, now: number = Date.now()): UntilParts {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h, m, s, locked: ms <= 0 };
}
export function ordinal(n: number | null | undefined): string {
  if (n == null) return '—';
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}
```

- [ ] **Step 3: Unit tests**

Create `src/components/design/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ordinal, untilText, untilParts, fmtDate } from './time';

describe('ordinal', () => {
  it('handles 1..4, teens, and 21..24', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(null)).toBe('—');
  });
});

describe('untilText', () => {
  const base = new Date('2026-05-17T10:00:00Z').getTime();
  it('renders days + hours for far future', () => {
    expect(untilText('2026-05-19T12:00:00Z', base)).toBe('2d 2h');
  });
  it('renders hours + minutes for same day', () => {
    expect(untilText('2026-05-17T11:42:00Z', base)).toBe('1h 42m');
  });
  it('renders minutes only for under an hour', () => {
    expect(untilText('2026-05-17T10:30:00Z', base)).toBe('30m');
  });
  it('returns Locked when in the past', () => {
    expect(untilText('2026-05-17T09:00:00Z', base)).toBe('Locked');
  });
});

describe('untilParts', () => {
  it('returns zeroes and locked=true when past', () => {
    const p = untilParts('2026-05-17T09:00:00Z', new Date('2026-05-17T10:00:00Z').getTime());
    expect(p).toEqual({ d: 0, h: 0, m: 0, s: 0, locked: true });
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npx vitest run src/components/design/time.test.ts --reporter=dot
git add src/components/design/teams.ts src/components/design/time.ts src/components/design/time.test.ts
git commit -m "feat(design): team-color lookup and date/ordinal helpers"
```

### Task E-3.2: Primitive atoms (Badge, Card, Button, Logo, LiveDot, TeamChip, BibTile, Dot)

**Files:**
- Create: `src/components/design/badge.tsx`
- Create: `src/components/design/card.tsx`
- Create: `src/components/design/button.tsx`
- Create: `src/components/design/logo.tsx`
- Create: `src/components/design/live-dot.tsx`
- Create: `src/components/design/team-chip.tsx`
- Create: `src/components/design/bib-tile.tsx`
- Create: `src/components/design/dot.tsx`

**Context:** Port these from `atoms.jsx:117-272` (prototype). The prototype passes `theme` as a prop; we use CSS vars so every atom reads `var(--accent)` etc. from computed style.

- [ ] **Step 1: `badge.tsx`**

```tsx
import type { CSSProperties, ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'soft' | 'muted' | 'ok' | 'warn' | 'danger' | 'outline';
type Size = 'xs' | 'sm' | 'md';

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  default: { bg: 'var(--surface-alt)', fg: 'var(--ink)',        bd: 'var(--hair)' },
  accent:  { bg: 'var(--accent)',      fg: 'var(--accent-ink)', bd: 'var(--accent)' },
  soft:    { bg: 'var(--accent-soft)', fg: 'var(--accent)',     bd: 'var(--accent-soft)' },
  muted:   { bg: 'transparent',        fg: 'var(--ink-mute)',   bd: 'var(--hair)' },
  ok:      { bg: 'transparent',        fg: 'var(--ok)',         bd: 'var(--ok)' },
  warn:    { bg: 'transparent',        fg: 'var(--warn)',       bd: 'var(--warn)' },
  danger:  { bg: 'var(--accent)',      fg: 'var(--accent-ink)', bd: 'var(--accent)' },
  outline: { bg: 'transparent',        fg: 'var(--ink)',        bd: 'var(--hair)' },
};

const SIZES: Record<Size, { fs: number; pad: string }> = {
  xs: { fs: 10, pad: '2px 6px' },
  sm: { fs: 11, pad: '3px 8px' },
  md: { fs: 12, pad: '4px 10px' },
};

export function Badge({ children, tone = 'default', size = 'sm', style }: {
  children: ReactNode; tone?: Tone; size?: Size; style?: CSSProperties;
}) {
  const s = TONES[tone];
  const z = SIZES[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: z.fs, fontWeight: 600, letterSpacing: 0.3,
      padding: z.pad, borderRadius: 999,
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
      textTransform: 'uppercase', ...style,
    }}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: `card.tsx`**

```tsx
import type { CSSProperties, ReactNode } from 'react';

export function Card({ children, pad = 16, style }: {
  children: ReactNode; pad?: number; style?: CSSProperties;
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--radius)',
      padding: pad,
      ...style,
    }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: `button.tsx`**

```tsx
'use client';
import type { CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, { bg: string; fg: string; bd: string }> = {
  primary: { bg: 'var(--ink)',        fg: 'var(--bg)',         bd: 'var(--ink)' },
  accent:  { bg: 'var(--accent)',     fg: 'var(--accent-ink)', bd: 'var(--accent)' },
  ghost:   { bg: 'transparent',       fg: 'var(--ink)',        bd: 'var(--hair)' },
  danger:  { bg: 'transparent',       fg: 'var(--danger)',     bd: 'var(--danger)' },
  quiet:   { bg: 'var(--surface-alt)',fg: 'var(--ink)',        bd: 'var(--hair)' },
};

const SIZES: Record<Size, { fs: number; pad: string; minH: number }> = {
  sm: { fs: 13, pad: '8px 12px', minH: 34 },
  md: { fs: 14, pad: '11px 16px', minH: 42 },
  lg: { fs: 15, pad: '14px 20px', minH: 50 },
};

export function DsButton({
  children, onClick, variant = 'primary', size = 'md',
  disabled, full, type = 'button', style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant; size?: Size;
  disabled?: boolean; full?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  const v = VARIANTS[variant];
  const z = SIZES[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: v.bg, color: v.fg, border: `1px solid ${v.bd}`,
        padding: z.pad, borderRadius: 'var(--radius)',
        fontWeight: 600, fontSize: z.fs, fontFamily: 'var(--font-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        minHeight: z.minH,
        width: full ? '100%' : 'auto',
        transition: 'transform 80ms ease, background 120ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
```

Named `DsButton` to avoid clashing with shadcn `Button` used by admin.

- [ ] **Step 4: `logo.tsx`, `live-dot.tsx`, `dot.tsx`**

`logo.tsx`:
```tsx
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--radius)',
      background: 'var(--accent)', color: 'var(--accent-ink)',
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size * 0.5, letterSpacing: -0.5,
    }}>Q</div>
  );
}
```

`live-dot.tsx`:
```tsx
export function LiveDot({ size = 7 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: size, height: size, borderRadius: 999, background: 'var(--accent)',
        boxShadow: '0 0 0 4px var(--accent-soft)',
        animation: 'qpulse 1.8s ease-out infinite',
      }} />
    </span>
  );
}
```

`dot.tsx`:
```tsx
export function Dot({ size = 8, color }: { size?: number; color: string }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: 999, background: color, flex: 'none' }} />;
}
```

- [ ] **Step 5: `team-chip.tsx`**

```tsx
import { resolveTeam } from './teams';

export function TeamChip({ team, size = 22, style }: {
  team: string | null | undefined;
  size?: number;
  style?: React.CSSProperties;
}) {
  const t = resolveTeam(team);
  return (
    <span
      title={t.name}
      style={{
        width: size, height: size, borderRadius: 4, flex: 'none',
        background: t.color, position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)', ...style,
      }}
    >
      <span style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, transparent 0 55%, ${t.accent} 55% 100%)`,
      }} />
    </span>
  );
}
```

- [ ] **Step 6: `bib-tile.tsx`**

```tsx
export function BibTile({ num, size = 36 }: { num: number | null | undefined; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size * 1.2, borderRadius: 'var(--radius)',
        background: '#fff', color: '#1a1714',
        border: '1px solid var(--hair)',
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: size * 0.42,
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.04)',
      }}
    >
      {num ?? '—'}
    </div>
  );
}
```

- [ ] **Step 7: Verify + commit**

```bash
npm run typecheck && npm run lint
git add src/components/design/{badge,card,button,logo,live-dot,dot,team-chip,bib-tile}.tsx
git commit -m "feat(design): primitive atoms (Badge, Card, DsButton, Logo, LiveDot, TeamChip, BibTile, Dot)"
```

### Task E-3.3: Complex atoms (TerrainGlyph, StageProfile, Countdown, SectionTitle, RiderRow)

**Files:**
- Create: `src/components/design/terrain-glyph.tsx`
- Create: `src/components/design/stage-profile.tsx`
- Create: `src/components/design/countdown.tsx`
- Create: `src/components/design/section-title.tsx`
- Create: `src/components/design/rider-row.tsx`

- [ ] **Step 1: `terrain-glyph.tsx`**

```tsx
export type Terrain = 'flat' | 'hilly' | 'mountain' | 'itt';

const PATHS: Record<Terrain, string> = {
  flat:     'M1 10 L15 10',
  hilly:    'M1 11 C 4 7, 6 7, 8 10 C 10 13, 12 5, 15 9',
  mountain: 'M1 13 L5 5 L8 10 L11 3 L15 13',
  itt:      'M1 10 L15 10 M10 7 L13 10 L10 13',
};

export function TerrainGlyph({ terrain, size = 14, color = 'currentColor' }: {
  terrain: Terrain; size?: number; color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[terrain]} />
    </svg>
  );
}
```

- [ ] **Step 2: `stage-profile.tsx`**

```tsx
import type { Terrain } from './terrain-glyph';

const CFG: Record<Terrain, number[]> = {
  flat:     [0.2, 0.22, 0.25, 0.2, 0.24, 0.22, 0.26, 0.3, 0.2, 0.18, 0.22, 0.25],
  hilly:    [0.22, 0.45, 0.3, 0.55, 0.35, 0.6, 0.4, 0.7, 0.45, 0.55, 0.35, 0.3],
  mountain: [0.15, 0.25, 0.5, 0.4, 0.7, 0.55, 0.85, 0.65, 0.95, 0.7, 0.5, 0.4],
  itt:      [0.15, 0.2, 0.22, 0.18, 0.22, 0.2, 0.18, 0.22, 0.2, 0.18, 0.22, 0.2],
};

export function StageProfile({ terrain, w = 220, h = 36, accent = 'var(--accent)', soft = 'var(--accent-soft)' }: {
  terrain: Terrain; w?: number; h?: number; accent?: string; soft?: string;
}) {
  const cfg = CFG[terrain];
  const step = w / (cfg.length - 1);
  const pts = cfg.map((v, i) => [i * step, h - v * h]);
  const d = 'M ' + pts.map((p) => p.join(',')).join(' L ');
  const area = d + ` L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={area} fill={soft} opacity={0.55} />
      <path d={d} fill="none" stroke={accent} strokeWidth={1.4} />
    </svg>
  );
}
```

- [ ] **Step 3: `countdown.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { untilParts, type UntilParts } from './time';

export function Countdown({ iso }: { iso: string }) {
  const [parts, setParts] = useState<UntilParts>(() => untilParts(iso));
  useEffect(() => {
    const id = setInterval(() => setParts(untilParts(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  const cells: Array<[string, number]> = parts.d > 0
    ? [['d', parts.d], ['h', parts.h], ['m', parts.m]]
    : [['h', parts.h], ['m', parts.m], ['s', parts.s]];

  return (
    <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
      {cells.map(([k, v]) => (
        <div key={k} style={{
          background: 'var(--surface-alt)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
          padding: '8px 10px', minWidth: 48, textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600,
            color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
          }}>
            {String(v).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>{k}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `section-title.tsx`**

```tsx
import type { ReactNode } from 'react';

export function SectionTitle({ eyebrow, title, right }: {
  eyebrow?: string; title: string; right?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
      <div>
        {eyebrow && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
            color: 'var(--ink-mute)', marginBottom: 4, fontFamily: 'var(--font-mono)',
          }}>{eyebrow}</div>
        )}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 'var(--display-weight)' as unknown as number,
          fontStyle: 'var(--display-italic)' as unknown as 'normal',
          fontSize: 22, lineHeight: 1.1, color: 'var(--ink)',
          letterSpacing: -0.3,
        }}>{title}</div>
      </div>
      {right}
    </div>
  );
}
```

Because `font-weight` + `font-style` from CSS vars cast awkwardly in TS, cast the vars. Alternative: use plain 600 / 'normal' values — the experimental theme is the only one so hardcoding is fine. If the type-cast feels ugly, inline the literal values.

- [ ] **Step 5: `rider-row.tsx`**

```tsx
'use client';
import type { ReactNode } from 'react';
import { BibTile } from './bib-tile';
import { TeamChip } from './team-chip';
import { resolveTeam } from './teams';

export interface RiderRowRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: 'active' | 'dnf' | 'dns';
}

export function RiderRow({
  rider, right, onClick, disabled, hint, dense, selected,
}: {
  rider: RiderRowRider;
  right?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string | null;
  dense?: boolean;
  selected?: boolean;
}) {
  const team = resolveTeam(rider.team);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={rider.name}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        textAlign: 'left',
        padding: dense ? '10px 12px' : '14px 14px',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        border: `1px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        borderBottom: '1px solid var(--hair)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        color: 'var(--ink)',
        borderRadius: 0,
      }}
    >
      <BibTile num={rider.bib} size={30} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {rider.name}
          </span>
          {rider.status === 'dnf' && (
            <span style={{ fontSize: 10, padding: '2px 6px', border: '1px solid var(--hair)', color: 'var(--ink-mute)', borderRadius: 999, textTransform: 'uppercase', fontWeight: 600 }}>DNF</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <TeamChip team={rider.team} size={9} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 1 }}>{hint}</div>
        )}
      </div>
      {right}
    </button>
  );
}
```

- [ ] **Step 6: Verify + commit**

```bash
npm run typecheck && npm run lint
git add src/components/design/{terrain-glyph,stage-profile,countdown,section-title,rider-row}.tsx
git commit -m "feat(design): complex atoms (TerrainGlyph, StageProfile, Countdown, SectionTitle, RiderRow)"
```

---

## Phase 4 — App shell

### Task E-4.1: TopBar + SideNav + BottomTabs

**Files:**
- Create: `src/components/app-shell.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Context:** Port `screens.jsx:7-204` (AppShell, TopBar, BottomTabs, SideNav) into one file. The existing `src/components/bottom-tabs.tsx` will be retired in Phase 11.

- [ ] **Step 1: Write `src/components/app-shell.tsx`**

```tsx
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/design/logo';
import { LiveDot } from '@/components/design/live-dot';
import { untilText } from '@/components/design/time';

const TABS: Array<{ href: string; label: string; icon: 'home' | 'picks' | 'board' | 'me' }> = [
  { href: '/home',  label: 'Home',  icon: 'home' },
  { href: '/picks', label: 'Picks', icon: 'picks' },
  { href: '/board', label: 'Board', icon: 'board' },
  { href: '/me',    label: 'Me',    icon: 'me' },
];

function NavIcon({ name, size = 22, color }: { name: 'home'|'picks'|'board'|'me'; size?: number; color: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':  return <svg {...common}><path d="M3 11 L12 3 L21 11" /><path d="M5 10 V21 H19 V10" /></svg>;
    case 'picks': return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 10 H16 M8 14 H13" /></svg>;
    case 'board': return <svg {...common}><path d="M4 20 V10 M10 20 V4 M16 20 V14 M22 20 H2" /></svg>;
    case 'me':    return <svg {...common}><circle cx="12" cy="9" r="4" /><path d="M4 20 C5 15 19 15 20 20" /></svg>;
  }
}

export function AppShell({ children, nextStageLabel, nextStageIso }: {
  children: ReactNode;
  nextStageLabel?: string;
  nextStageIso?: string;
}) {
  const pathname = usePathname();
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 880px)');
    const handle = () => setIsWide(mql.matches);
    handle();
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, []);

  const [untilLabel, setUntilLabel] = useState(() => (nextStageIso ? untilText(nextStageIso) : ''));
  useEffect(() => {
    if (!nextStageIso) return;
    const id = setInterval(() => setUntilLabel(untilText(nextStageIso)), 60_000);
    return () => clearInterval(id);
  }, [nextStageIso]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--hair)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)' }}>
            <Logo />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, letterSpacing: -0.3 }}>Quiniela</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: 1, marginTop: 3 }}>GIRO · MMXXVI</span>
            </span>
          </Link>
          {nextStageLabel && nextStageIso && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LiveDot />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
                {nextStageLabel} locks in {untilLabel}
              </div>
            </div>
          )}
        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: isWide ? '280px 1fr' : '1fr', maxWidth: 1180, margin: '0 auto', width: '100%' }}>
        {isWide && (
          <aside style={{ borderRight: '1px solid var(--hair)', padding: '24px 20px', position: 'sticky', top: 61, alignSelf: 'start', height: 'calc(100vh - 61px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TABS.map((t) => {
                const active = pathname === t.href || (t.href === '/picks' && pathname.startsWith('/picks'));
                return (
                  <Link key={t.href} href={t.href} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--ink)',
                    padding: '10px 12px', borderRadius: 'var(--radius)',
                    fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  }}>
                    <NavIcon name={t.icon} color={active ? 'var(--accent)' : 'var(--ink-soft)'} size={18} />
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </aside>
        )}
        <div style={{ padding: isWide ? '28px 32px 120px' : '0 0 90px', minWidth: 0 }}>
          {children}
        </div>
      </main>

      {!isWide && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderTop: '1px solid var(--hair)',
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', zIndex: 20,
        }}>
          {TABS.map((t) => {
            const active = pathname === t.href || (t.href === '/picks' && pathname.startsWith('/picks'));
            return (
              <Link key={t.href} href={t.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 0', color: active ? 'var(--accent)' : 'var(--ink-soft)',
                textDecoration: 'none',
              }}>
                <NavIcon name={t.icon} color={active ? 'var(--accent)' : 'var(--ink-soft)'} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `src/app/(app)/layout.tsx`**

Replace the body of the layout so it loads the next upcoming counted stage and feeds the shell:

```tsx
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  const edition = await getActiveEdition();

  let nextStage: { number: number; start_time: string } | null = null;
  if (edition) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('stages')
      .select('number, start_time')
      .eq('edition_id', edition.id)
      .eq('counts_for_scoring', true)
      .gt('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) nextStage = data;
  }

  return (
    <AppShell
      nextStageLabel={nextStage ? `St. ${nextStage.number}` : undefined}
      nextStageIso={nextStage?.start_time}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm run build
git add src/components/app-shell.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(design): new app shell with TopBar, SideNav, BottomTabs"
```

---

## Phase 5 — Home screen

### Task E-5.1: Hero + Timeline + query helpers

**Files:**
- Create: `src/lib/queries/home.ts`
- Create: `src/components/stage-timeline.tsx`
- Modify: `src/app/(app)/home/page.tsx`

- [ ] **Step 1: Query helpers**

Write `src/lib/queries/home.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getActiveEdition } from '@/lib/queries/stages';

export async function getHomeData(userId: string) {
  const edition = await getActiveEdition();
  if (!edition) return null;

  const supabase = await createClient();

  const [{ data: stages }, { data: picks }, { data: results }, { data: board }] = await Promise.all([
    supabase
      .from('stages').select('id, number, start_time, counts_for_scoring, double_points, status, terrain, km')
      .eq('edition_id', edition.id).order('number', { ascending: true }),
    supabase
      .from('stage_picks').select('stage_id, rider_id, stages!inner(number), riders!inner(id, name, team, bib, status)')
      .eq('user_id', userId),
    supabase
      .from('stage_results').select('stage_id, position, rider_id, status')
      .in('status', ['published']),
    supabase
      .from('leaderboard_view').select('user_id, display_name, stage_points, gc_points, jersey_points, total_points, exact_winners_count, rank')
      .eq('edition_id', edition.id).order('rank', { ascending: true }),
  ]);

  return {
    edition,
    stages: stages ?? [],
    picks: picks ?? [],
    results: results ?? [],
    board: board ?? [],
  };
}
```

Depending on your existing `leaderboard_view` columns, adjust fields to match.

- [ ] **Step 2: StageTimeline component**

Write `src/components/stage-timeline.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Badge } from '@/components/design/badge';
import { TerrainGlyph, type Terrain } from '@/components/design/terrain-glyph';

export interface TimelineStage {
  n: number;
  name: string;
  km: number;
  terrain: Terrain;
  lock: string;
  counted: boolean;
  double: boolean;
  status: 'upcoming' | 'locked' | 'results_draft' | 'published' | 'cancelled';
  pickRiderName: string | null;
  pickPoints: number | null;
}

export function StageTimeline({ stages, currentNumber }: { stages: TimelineStage[]; currentNumber: number | null }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current.querySelector("[data-current='true']");
    if (el) (el as HTMLElement).scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 2px 8px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1.4, color: 'var(--ink-mute)', textTransform: 'uppercase' }}>
          21 Stages · swipe →
        </div>
        <Link href="/picks" style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>All picks</Link>
      </div>
      <div ref={scrollerRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 6 }}>
        {stages.map((s) => {
          const isCurrent = s.n === currentNumber;
          const scored = s.status === 'published';
          const href = scored ? `/stage/${s.n}` : (s.counted ? `/picks/stage/${s.n}` : `/stage/${s.n}`);
          const tone = scored
            ? { border: 'var(--hair)',   bg: 'var(--surface)',     accent: 'var(--ink-soft)' }
            : isCurrent
            ? { border: 'var(--accent)', bg: 'var(--surface)',     accent: 'var(--accent)' }
            : { border: 'var(--hair)',   bg: 'var(--surface)',     accent: 'var(--ink-soft)' };

          return (
            <Link key={s.n} href={href} data-current={isCurrent ? 'true' : 'false'}
              style={{
                flex: 'none', width: 132, scrollSnapAlign: 'start',
                background: tone.bg, border: `1.5px solid ${tone.border}`,
                borderRadius: 'var(--radius)', padding: 10, textDecoration: 'none',
                color: 'var(--ink)', position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1, color: 'var(--ink-mute)' }}>
                  ST {String(s.n).padStart(2, '0')}
                </span>
                {s.double && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>2×</span>}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, lineHeight: 1,
                margin: '4px 0 6px', color: tone.accent,
              }}>{s.n}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', height: 28, overflow: 'hidden', lineHeight: 1.2 }}>{s.name}</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <TerrainGlyph terrain={s.terrain} color="var(--ink-mute)" size={12} />
                <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>{s.km}km</span>
              </div>
              <div style={{ marginTop: 8 }}>
                {!s.counted ? (
                  <Badge tone="muted" size="xs">Not counted</Badge>
                ) : scored ? (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: (s.pickPoints ?? 0) > 0 ? 'var(--accent)' : 'var(--ink-mute)' }}>
                    {s.pickPoints != null ? `+${s.pickPoints}` : '—'}
                  </span>
                ) : isCurrent ? (
                  <Badge tone={s.pickRiderName ? 'soft' : 'accent'} size="xs">
                    {s.pickRiderName ? 'Picked' : 'Pick now'}
                  </Badge>
                ) : (
                  <Badge tone="outline" size="xs">{s.pickRiderName ? 'Picked' : 'Open'}</Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Rewrite Home page**

Rewrite `src/app/(app)/home/page.tsx` using the hero/timeline/standing/recent/topfive/prerace layout from `screens.jsx:207-637`. Port each sub-component as a server-or-client component. The hero uses the `Countdown` atom (client) — wrap it in a client subcomponent. Everything else can be RSC.

Break this Task into Step 3a (hero + countdown client wrapper), Step 3b (standing card + stat cells), Step 3c (recent picks card + top five card), Step 3d (pre-race card). Each a separate commit.

Because these sub-components are straight ports of `screens.jsx`, save implementer time: tell them to copy-paste from `screens.jsx:231-637` and swap `theme.x` lookups for CSS vars, replace `<Badge tone="accent">2× points</Badge>` style usage with our new Badge, and change handler navigation from `setRoute` to `<Link>` or `router.push`.

- [ ] **Step 4: Verify + commit after each sub-step**

Sub-step commit messages:
```
feat(home): hero with next-stage countdown and pick summary
feat(home): standing card with stage/gc/exact stat cells
feat(home): recent picks + top-five cards
feat(home): pre-race glance card
```

- [ ] **Step 5: Full-page smoke**

Start dev, sign in, visit `/home`. Confirm:
- Hero countdown ticks
- Timeline auto-scrolls to the current stage
- Standing card shows rank + totals + deltas
- Top-five shows me highlighted if in top 5, else collapsed `· · ·` + around-me rows
- Pre-race card shows GC slots + jersey (or placeholder if no picks yet)

---

## Phase 6 — Picks index + Stage picker

### Task E-6.1: Picks index redesign

**Files:**
- Modify: `src/app/(app)/picks/page.tsx`
- Create helper: `src/lib/queries/picks-index.ts`

**Context:** Port `screens.jsx:640-853` (PicksScreen, PreRaceStrip, UsedRidersStrip, StageRow, NonCountedStagesNote) into a server component that pulls data from our real queries.

- [ ] **Step 1: Helper query**

Write `src/lib/queries/picks-index.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getActiveEdition } from '@/lib/queries/stages';

export async function getPicksIndex(userId: string) {
  const edition = await getActiveEdition();
  if (!edition) return null;

  const supabase = await createClient();

  const [{ data: stages }, { data: picks }, { data: results }, { data: gcPicks }, { data: jerseyPick }] = await Promise.all([
    supabase.from('stages')
      .select('id, number, start_time, counts_for_scoring, double_points, status, terrain, km')
      .eq('edition_id', edition.id).order('number', { ascending: true }),
    supabase.from('stage_picks')
      .select('stage_id, rider_id, stages!inner(number, status, double_points), riders!inner(id, name, team, bib, status)')
      .eq('user_id', userId),
    supabase.from('stage_results')
      .select('stage_id, position, rider_id').eq('status', 'published'),
    supabase.from('gc_picks')
      .select('position, rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', userId).eq('edition_id', edition.id).order('position'),
    supabase.from('points_jersey_picks')
      .select('rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', userId).eq('edition_id', edition.id).maybeSingle(),
  ]);

  return { edition, stages: stages ?? [], picks: picks ?? [], results: results ?? [], gcPicks: gcPicks ?? [], jerseyPick };
}
```

- [ ] **Step 2: Write the new Picks page**

Replace `src/app/(app)/picks/page.tsx` with a server component that:
- Loads `getPicksIndex(user.id)`
- Computes `pointsTable = [25,15,10,8,6,5,4,3,2,1]` and looks up position of each pick in results to render points
- Renders `<PageHeading eyebrow="Your picks" title="Picks" sub="… counted stages still open." />`
- Renders `<PreRaceStrip />` (GC + Jersey locked cards)
- Renders `<UsedRidersStrip />` showing riders consumed so far
- Renders each counted stage via `<StageRow />`
- Renders `<NonCountedStagesNote />`

Break into sub-steps one commit each:
- `feat(picks): page heading + pre-race strip`
- `feat(picks): used-riders ledger`
- `feat(picks): counted-stage rows with pick/score states`

- [ ] **Step 3: Smoke**

Visit `/picks`. Confirm: counted stages listed, used riders pill row, pre-race GC/Jersey visible. Click a stage → routes to `/picks/stage/N` (unlocked) or `/stage/N` (locked/scored).

### Task E-6.2: Stage picker redesign

**Files:**
- Modify: `src/app/(app)/picks/stage/[stageNumber]/page.tsx`
- Modify: `src/app/(app)/picks/stage/[stageNumber]/form.tsx`
- Modify: `src/components/rider-picker.tsx`

**Context:** The existing RiderPicker already has semantic buttons from Plan D fix #1. Restyle the interior to match `RiderRow` atom aesthetics while keeping its API (props: `riders`, `selectedId`, `onSelect`, `disableUsed`, `disableInactive`).

- [ ] **Step 1: Restyle `rider-picker.tsx`**

Update the `<ul>` wrapper styles to use var tokens; update each `<button>` row to match `RiderRow`'s layout (BibTile + name + team chip + hint + right slot). Keep all props and callbacks identical.

- [ ] **Step 2: Rewrite the stage picker page**

In `form.tsx`, add the `StagePickHeader` (stage number, name, terrain badge, profile SVG), the current-pick summary card, search + filter chips, rider list (delegates to `RiderPicker`), and sticky Save CTA. Port from `screens.jsx:857-1081`.

The existing save action stays the same — just re-skin.

- [ ] **Step 3: Smoke + commit**

```bash
npm run build && SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/ --reporter=dot
git add src/components/rider-picker.tsx src/app/\(app\)/picks/stage/\[stageNumber\]/
git commit -m "feat(picks): redesign stage picker with header, summary, sticky save"
```

---

## Phase 7 — Stage detail

### Task E-7.1: Top-10 table + who-picked-whom

**Files:**
- Modify: `src/app/(app)/stage/[stageNumber]/page.tsx`
- Create: `src/lib/queries/stage-detail.ts`

- [ ] **Step 1: Query**

Write `src/lib/queries/stage-detail.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getStageDetail(stageId: string, currentUserId: string) {
  const supabase = await createClient();
  const [{ data: stage }, { data: results }, { data: allPicks }] = await Promise.all([
    supabase.from('stages').select('id, number, start_time, status, counts_for_scoring, double_points, terrain, km').eq('id', stageId).maybeSingle(),
    supabase.from('stage_results').select('position, rider_id, status, riders!inner(id, name, team, bib)').eq('stage_id', stageId).order('position'),
    supabase.from('stage_picks').select('user_id, rider_id, profiles!inner(display_name), riders!inner(id, name, team, bib)').eq('stage_id', stageId),
  ]);

  const isLocked = stage ? new Date(stage.start_time).getTime() <= Date.now() : false;
  return {
    stage,
    results: stage?.status === 'published' ? (results ?? []) : [],
    allPicks: isLocked ? (allPicks ?? []) : [],
    currentUserId,
    isLocked,
  };
}
```

- [ ] **Step 2: Rewrite `stage/[stageNumber]/page.tsx`**

Render:
- `<StagePickHeader />` (shared with stage picker)
- If `results.length > 0`: Top-10 card with `{position, bib, rider, pickers count, points}` per row. Highlight my pick row.
- If locked but not scored: a `<Card>` with `Waiting for results. Typically published within ~2h.`
- If locked: `<WhoPickedWhom />` grouped list
- If not locked: no picks reveal (only hero visible; the user should navigate to `/picks/stage/N` to pick)

Port from `screens.jsx:1084-1250`. `groupPicks` helper can live inline in the page.

- [ ] **Step 3: Smoke + commit**

```bash
npm run build
git add src/lib/queries/stage-detail.ts src/app/\(app\)/stage/\[stageNumber\]/page.tsx
git commit -m "feat(stage): redesign stage detail with top-10 + who-picked-whom"
```

---

## Phase 8 — GC + Jersey pickers

### Task E-8.1: GC three-slot picker

**Files:**
- Modify: `src/app/(app)/picks/gc/page.tsx`
- Create (if missing): `src/app/(app)/picks/gc/form.tsx`

- [ ] **Step 1: Page (server)**

Keep the existing server component that checks `isLocked` + loads current picks + active riders. Pass to a new client form.

- [ ] **Step 2: Client form**

Port `screens.jsx:1253-1313`. Three slot tiles labeled `1st`, `2nd`, `3rd`. Tapping a tile (when unlocked) opens the rider-picker list inline (no modal needed for v1 — reuse `<RiderPicker>` filtered to "available for this slot", and highlight the clicked slot's current rider).

Key UI bits:
- Three slot `<button>`s in a `grid-template-columns: repeat(3, 1fr)` layout.
- Each slot shows: large `1st/2nd/3rd` display-serif numeral (color `var(--accent)`), team chip, rider last name, bib.
- Scoring explainer card below: `30 pts exact · 10 pts in podium · 0 otherwise. Max 90.`
- If locked, slot buttons are disabled with a `Locked since Stage 1` badge.

The save action stays identical to the current `submitGcPicks`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/picks/gc/
git commit -m "feat(gc): redesign GC top-3 picker with three-slot layout"
```

### Task E-8.2: Jersey picker

**Files:**
- Modify: `src/app/(app)/picks/jersey/page.tsx`
- Create (if missing): `src/app/(app)/picks/jersey/form.tsx`

- [ ] **Step 1: Page + form**

Render a header `<PageHeading eyebrow="Pre-race" title="Points jersey" sub="30 pts if correct · 0 otherwise." />`, a single `<RiderPicker>` with the no-reuse rules inapplicable (jersey has no consumed-rider concept), and a sticky Save CTA. Add a small pink-tinted jersey glyph decoration like the one in `screens.jsx:620-628`.

If locked (Stage 1 passed), show `Locked since Stage 1` and disable the picker.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/picks/jersey/
git commit -m "feat(jersey): redesign points-jersey picker"
```

---

## Phase 9 — Board + Me

### Task E-9.1: Board screen

**Files:**
- Modify: `src/app/(app)/board/page.tsx`
- Create: `src/app/(app)/board/client.tsx`

- [ ] **Step 1: Server page**

Server component fetches full `leaderboard_view` rows, computes `max(total_points)`, and passes to the client for view-switching.

- [ ] **Step 2: Client component**

Render `<PageHeading eyebrow="Leaderboard · 34 players" title="Classifica" sub="Sorted by total points · ties broken by exact winners." />`, the three-view toggle (Total / Stage pts / ★ Exact), the board table, and the sticky `Your rank` pink summary at the bottom. Port from `screens.jsx:1316-1419`.

The table header/body uses a fixed `grid-template-columns: 36px 1fr 54px 44px 54px` pattern.

The per-row progress bar is `height: 3px; max-width: 160px; background: var(--hair)` with an inner fill `width: ${(total / max) * 100}%; background: isMe ? var(--accent) : var(--ink)`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/board/
git commit -m "feat(board): redesign leaderboard with view switcher and sticky you summary"
```

### Task E-9.2: Me screen

**Files:**
- Modify: `src/app/(app)/me/page.tsx`
- Create: `src/lib/queries/me.ts`

- [ ] **Step 1: Query**

Write `src/lib/queries/me.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getActiveEdition } from '@/lib/queries/stages';

export async function getMeData(userId: string) {
  const edition = await getActiveEdition();
  if (!edition) return null;

  const supabase = await createClient();

  const [{ data: profile }, { data: board }, { data: scoredPicks }, { data: gc }, { data: jersey }] = await Promise.all([
    supabase.from('profiles').select('display_name, email').eq('id', userId).single(),
    supabase.from('leaderboard_view').select('*').eq('edition_id', edition.id).eq('user_id', userId).maybeSingle(),
    supabase.from('stage_picks')
      .select('stage_id, rider_id, stages!inner(number, double_points, status, name:number), riders!inner(id, name, team, bib)')
      .eq('user_id', userId),
    supabase.from('gc_picks').select('position, rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', userId).eq('edition_id', edition.id).order('position'),
    supabase.from('points_jersey_picks').select('rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', userId).eq('edition_id', edition.id).maybeSingle(),
  ]);

  const { data: results } = await supabase.from('stage_results')
    .select('stage_id, position, rider_id').eq('status', 'published');

  return { profile, board, scoredPicks: scoredPicks ?? [], gc: gc ?? [], jersey, results: results ?? [] };
}
```

- [ ] **Step 2: Page**

Render:
- `<PageHeading eyebrow="Your account" title="You" sub={profile.email} />`
- Four `<BigStat>` tiles: Rank, Points, Exact, Made (`pickCount/countedStageCount`)
- `<SectionHeading label="Stage picks · history" />` + a `<Card>` of scored pick rows
- `<SectionHeading label="Pre-race picks" />` + GC slot grid + Jersey row
- `<SectionHeading label="Account" />` + settings rows (Display name, Email, Edition, Notifications) + a Sign out button (wires to existing `<SignOutButton>`)

Port from `screens.jsx:1422-1528`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/me.ts src/app/\(app\)/me/
git commit -m "feat(me): redesign account screen with history, pre-race, settings"
```

---

## Phase 10 — PWA + E2E

### Task E-10.1: PWA brand refresh

**Files:**
- Modify: `public/manifest.webmanifest`
- Modify: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

- [ ] **Step 1: Manifest**

Update the existing manifest to:

```json
{
  "name": "Quiniela Giro",
  "short_name": "Quiniela",
  "description": "Private Giro d'Italia pickem game",
  "start_url": "/home",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0b0d10",
  "theme_color": "#0b0d10",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Regenerate icons**

```bash
magick -size 512x512 xc:'#0b0d10' \
  -fill '#ff2e8e' -gravity center -pointsize 260 -annotate 0 'Q' \
  public/icon-512.png
magick public/icon-512.png -resize 192x192 public/icon-192.png
magick public/icon-512.png -resize 180x180 public/apple-touch-icon.png
```

If ImageMagick is unavailable, use the same Node + sharp fallback as Plan D Phase 3.

- [ ] **Step 3: Commit**

```bash
git add public/manifest.webmanifest public/icon-192.png public/icon-512.png public/apple-touch-icon.png
git commit -m "feat(pwa): re-tint manifest and icons to experimental palette"
```

### Task E-10.2: E2E selector audit

**Files:**
- Modify: `e2e/player-pick.spec.ts`
- Modify: `e2e/admin-publish.spec.ts`

**Context:** The redesigned player pages may change which text/role queries the E2E specs rely on. Admin is untouched so `admin-publish.spec.ts` should still pass — but verify.

- [ ] **Step 1: Run E2E**

```bash
npx playwright test --project=chromium-mobile
```

- [ ] **Step 2: Fix any breaks**

Common fixes:
- The Save button label may have shifted — use `getByRole('button', { name: /save pick/i })` (already accepted in player-pick test).
- The "Current pick" banner now renders inside the summary Card; selector `getByText(/Current pick/i)` should still match.
- The "50" leaderboard text may be surrounded by more number markup — use `page.locator('text=50').first()` if `getByText(/50/).first()` struggles.

Keep selectors role/name based; do not introduce test IDs unless a genuinely ambiguous UI demands them.

- [ ] **Step 3: Commit once green**

```bash
git add e2e/
git commit -m "test(e2e): update selectors for redesigned player screens"
```

---

## Phase 11 — Cleanup + review

### Task E-11.1: Delete retired components

**Files:**
- Delete: `src/components/bottom-tabs.tsx`
- Delete: `src/components/countdown-badge.tsx`

- [ ] **Step 1: Verify no imports remain**

```bash
grep -rn "bottom-tabs\|countdown-badge" src/
```

Expected: zero results. If hits, replace with the new AppShell + Countdown.

- [ ] **Step 2: Delete + commit**

```bash
git rm src/components/bottom-tabs.tsx src/components/countdown-badge.tsx
npm run typecheck && npm run lint && npm run build
git commit -m "chore: remove bottom-tabs and countdown-badge superseded by design atoms"
```

### Task E-11.2: Final sanity + code review

- [ ] **Step 1: Full suite**

```bash
npm run typecheck
npm run lint
npx vitest run --reporter=dot
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/ --reporter=dot
npm run build
npx playwright test --project=chromium-mobile
```

All green.

- [ ] **Step 2: Holistic review via code-reviewer subagent**

Dispatch `feature-dev:code-reviewer` against the Plan E commit range. Focus prompts:
- Cross-phase consistency (do all screens use CSS vars, never hex literals?)
- Type safety (no `any` sneaked in via prototype port?)
- Accessibility regressions (rider-picker still semantic, bottom tabs still links?)
- Dead code / over-engineering (any prototype-only utilities shipped?)
- PWA still installable (manifest valid, icons real PNGs, meta theme-color matches)

If the reviewer flags Blockers, fix and re-review. Important items → file-based issues for future polish; note in report.

- [ ] **Step 3: Manual smoke**

Sign in as dev-player, walk all screens on mobile viewport (Chrome DevTools device mode → Pixel 7):
1. Home: hero ticks, timeline scrolls, cards render
2. Picks: used-rider ledger shows, stage rows tap through
3. Stage picker: search, filter, save
4. Stage detail (scored): top-10 + who-picked-whom
5. GC: tap slots, rider-picker sheet opens
6. Jersey: single picker
7. Board: view toggles, sticky you summary
8. Me: stats, history, account

Note any broken links or visual glitches in a new `docs/plan-e-smoke.md` (follow the same shape as `docs/smoke-plan-c.md`).

---

## Self-review

**Spec coverage (vs prototype):**

| Prototype element | Plan E task |
|---|---|
| Experimental theme tokens | E-2.2 |
| Fonts (Space Grotesk, Inter Tight, JetBrains Mono) | E-2.1 |
| BibTile, TeamChip, Logo, LiveDot, Badge, Card, DsButton | E-3.2 |
| TerrainGlyph, StageProfile, Countdown, SectionTitle, RiderRow | E-3.3 |
| TopBar + SideNav + BottomTabs | E-4.1 |
| Hero next-stage + countdown | E-5.1 Step 3a |
| Swipeable stage timeline | E-5.1 Step 2 |
| Standing + recent + top-five + pre-race cards | E-5.1 Steps 3b/3c/3d |
| Picks index (pre-race strip, used-riders, stage rows) | E-6.1 |
| Stage picker (header, summary, search, list, sticky save) | E-6.2 |
| Stage detail (top-10, who picked whom) | E-7.1 |
| GC three-slot picker | E-8.1 |
| Jersey picker | E-8.2 |
| Board with view switcher + sticky summary | E-9.1 |
| Me screen (stats, history, pre-race, account) | E-9.2 |
| PWA brand refresh | E-10.1 |

**Placeholder scan:** The Home sub-component steps (E-5.1 Step 3a–3d) reference "port from screens.jsx:231-637" rather than writing full code inline. This is the only deliberate deviation from "complete code in every step" — the source is 400 lines, matches the CSS-var pattern verbatim once `theme.x` → CSS vars, and the implementer has the file on disk. If this proves too loose during execution, the implementer should split each card into its own tiny task with the full code copied in.

**Type consistency:** `TimelineStage` (in `stage-timeline.tsx`), `RiderRowRider` (in `rider-row.tsx`), and the query return shapes all name fields the same way (`n`, `number`, `bib`, `riderId`) consistent with the prototype; audit at the end of Phase 5 to catch drift before downstream phases depend on it.

**Scope discipline:** No schema changes beyond `terrain` + `km`. No new product features (no live stage gaps, no broadcaster widgets, no Tweaks panel). No admin UI changes beyond exposing the two new columns. Nothing server-side.

---

## Deliverables

- ✅ Dark experimental palette site-wide via CSS vars
- ✅ Space Grotesk + Inter Tight + JetBrains Mono fonts
- ✅ 13 reusable atoms under `src/components/design/`
- ✅ New AppShell with responsive TopBar + SideNav + BottomTabs
- ✅ All 7 player screens rebuilt: Home, Picks, Stage pick, Stage detail, GC, Jersey, Board, Me
- ✅ Swipeable stage timeline on Home
- ✅ Used-rider ledger on Picks
- ✅ `stages.terrain` + `stages.km` in the DB, editable by admins
- ✅ PWA brand re-tinted
- ✅ E2E + unit + integration all green
