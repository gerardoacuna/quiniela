# Home Pre-Race Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During the pre-race window (before stage 1 starts), the Home hero prompts the user to make their pre-race picks (GC Top 5 + Points + Youth jerseys) instead of jumping to a counted stage's pick prompt; after stage 1 locks it reverts to the existing next-stage hero.

**Architecture:** A pure `isPreRaceOpen()` helper + a new presentational `HeroPreRace` component. `home/page.tsx` renders `HeroPreRace` when the pre-race window is open (else the existing `HeroNextStage`/"All stages complete." unchanged), using pick data it already fetches.

**Tech Stack:** Next.js (App Router, RSC), React, existing design components (`Badge`, `Countdown`, `fmtDate`), Vitest.

## Global Constraints

- Trigger: pre-race hero shows for the **whole pre-race window** — `stage 1 exists && now < stage1.start_time` — for all users; after lock, revert to `HeroNextStage`. Fail closed (no/invalid stage1 → next-stage hero).
- Hero content: eyebrow `Pre-race · locks {fmtDate(stage1.start_time)}` + `Countdown` to stage 1 start; headline `Make your pre-race picks` (→ `Pre-race picks locked in` when all three done); three Done/Missing status chips (GC Top 5, Points jersey, Youth jersey); single primary CTA → `/picks` (`Make pre-race picks →` / `Review pre-race picks →` when all done).
- Completion: `gcDone = gcPicks.length === 5`, `pointsDone = jerseyPicks.points != null`, `youthDone = jerseyPicks.white != null`.
- No new queries (reuse the GC/jersey picks already fetched in `home/page.tsx`), no new design tokens, no change to `HeroNextStage` or the bottom `PreRaceCard`.
- Reuse the existing `now` (`const now = Date.now()`) already in `home/page.tsx` — do not add a second `Date.now()` call.
- Deps installed; verify with `npx vitest run`, `npx tsc --noEmit`, `npm run build`. (Home is auth-gated — no anon curl check; verification is unit + static.)

---

### Task 1: `isPreRaceOpen` helper (pure, TDD)

**Files:**
- Create: `src/app/(app)/home/pre-race-open.ts`
- Test: `src/app/(app)/home/pre-race-open.test.ts`

**Interfaces:**
- Produces: `isPreRaceOpen(stage1StartIso: string | null | undefined, nowMs: number): boolean`.

- [ ] **Step 1: Write the failing test**

`src/app/(app)/home/pre-race-open.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isPreRaceOpen } from './pre-race-open';

describe('isPreRaceOpen', () => {
  const start = '2026-07-04T15:05:00+00:00';
  const startMs = Date.parse(start);

  it('is true before stage 1 start', () => {
    expect(isPreRaceOpen(start, startMs - 1)).toBe(true);
  });
  it('is false at/after stage 1 start', () => {
    expect(isPreRaceOpen(start, startMs)).toBe(false);
    expect(isPreRaceOpen(start, startMs + 1)).toBe(false);
  });
  it('is false when stage1 start is missing or invalid', () => {
    expect(isPreRaceOpen(null, startMs)).toBe(false);
    expect(isPreRaceOpen(undefined, startMs)).toBe(false);
    expect(isPreRaceOpen('not-a-date', startMs)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/app/\(app\)/home/pre-race-open.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

`src/app/(app)/home/pre-race-open.ts`:
```ts
// True during the pre-race window: stage 1 exists and hasn't started yet.
// Fails closed (false) when the start time is missing or unparseable.
export function isPreRaceOpen(
  stage1StartIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (!stage1StartIso) return false;
  const start = Date.parse(stage1StartIso);
  if (Number.isNaN(start)) return false;
  return nowMs < start;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/app/\(app\)/home/pre-race-open.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/home/pre-race-open.ts" "src/app/(app)/home/pre-race-open.test.ts"
git commit -m "feat(home): isPreRaceOpen helper for pre-race window"
```

---

### Task 2: `HeroPreRace` component + wire into Home

**Files:**
- Create: `src/app/(app)/home/hero-pre-race.tsx`
- Modify: `src/app/(app)/home/page.tsx`

**Interfaces:**
- Consumes: `isPreRaceOpen` (Task 1); existing `gcPicks`/`jerseyPicks` in `home/page.tsx`; `Badge`, `Countdown`, `fmtDate`.
- Produces: `HeroPreRace({ stage1StartIso: string; gcDone: boolean; pointsDone: boolean; youthDone: boolean })`.

- [ ] **Step 1: Create the component**

`src/app/(app)/home/hero-pre-race.tsx`:
```tsx
import Link from 'next/link';
import { Countdown } from '@/components/design/countdown';
import { Badge } from '@/components/design/badge';
import { fmtDate } from '@/components/design/time';

export function HeroPreRace({
  stage1StartIso,
  gcDone,
  pointsDone,
  youthDone,
}: {
  stage1StartIso: string;
  gcDone: boolean;
  pointsDone: boolean;
  youthDone: boolean;
}) {
  const allDone = gcDone && pointsDone && youthDone;
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--radius)',
      padding: '22px 20px 20px',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 140, height: 140,
        background: 'var(--accent)', opacity: 0.08, borderRadius: 200, pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1.2,
            color: 'var(--ink-mute)', textTransform: 'uppercase',
          }}>
            Pre-race · locks {fmtDate(stage1StartIso)}
          </div>
          <h1 style={{
            margin: '4px 0 0',
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--display-weight)' as React.CSSProperties['fontWeight'],
            fontSize: 40, lineHeight: 1, letterSpacing: -0.6, color: 'var(--ink)',
          }}>
            {allDone ? 'Pre-race picks locked in' : 'Make your pre-race picks'}
          </h1>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)', marginTop: 6, fontWeight: 500 }}>
            GC Top 5 · Points jersey · Youth jersey
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <StatusChip label="GC Top 5" done={gcDone} />
            <StatusChip label="Points jersey" done={pointsDone} />
            <StatusChip label="Youth jersey" done={youthDone} />
          </div>
        </div>
        <Countdown iso={stage1StartIso} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Link
          href="/picks"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--accent)', color: 'var(--accent-ink)', border: '1px solid var(--accent)',
            padding: '11px 16px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 14,
            fontFamily: 'var(--font-body)', minHeight: 42, flex: 1, textDecoration: 'none',
          }}
        >
          {allDone ? 'Review pre-race picks' : 'Make pre-race picks'} →
        </Link>
      </div>
    </section>
  );
}

function StatusChip({ label, done }: { label: string; done: boolean }) {
  return done
    ? <Badge tone="ok" size="sm">✓ {label}</Badge>
    : <Badge tone="muted" size="sm">{label}</Badge>;
}
```

- [ ] **Step 2: Wire the conditional into `home/page.tsx`**

Add imports at the top of `src/app/(app)/home/page.tsx` (near the other `./` imports):
```tsx
import { HeroPreRace } from './hero-pre-race';
import { isPreRaceOpen } from './pre-race-open';
```

After the `jerseyPicks` object is built (immediately before the `return (`), add:
```tsx
  const stage1 = data.stages.find((s) => s.number === 1) ?? null;
  const preRaceOpen = isPreRaceOpen(stage1?.start_time, now);
  const gcDone = gcPicks.length === 5;
  const pointsDone = jerseyPicks.points != null;
  const youthDone = jerseyPicks.white != null;
```
(`now` is the existing `const now = Date.now()` already declared earlier in the function; `data.stages` is the full, unfiltered stage list so stage 1 is present even though it isn't counted.)

Replace the current hero block (the `{nextStage ? (<HeroNextStage …/>) : (<div>All stages complete.</div>)}` at the start of the returned JSX) with:
```tsx
      {preRaceOpen && stage1 ? (
        <HeroPreRace
          stage1StartIso={stage1.start_time}
          gcDone={gcDone}
          pointsDone={pointsDone}
          youthDone={youthDone}
        />
      ) : nextStage ? (
        <HeroNextStage
          stage={nextStage}
          pick={{
            primary: myPickForNext?.riders ?? null,
            underdog: myPickForNext?.underdog_rider ?? null,
          }}
          nextStageHref={`/picks/stage/${nextStage.number}`}
          stageHref={`/stage/${nextStage.number}`}
        />
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
          padding: '22px 20px',
          fontSize: 15,
          color: 'var(--ink-soft)',
        }}>
          All stages complete.
        </div>
      )}
```
(The `HeroNextStage` and "All stages complete." branches are byte-for-byte the current code — only the `preRaceOpen && stage1` branch is new and placed first.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → succeeds.
Run: `npx vitest run` → all pass (incl. Task 1).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/home/hero-pre-race.tsx" "src/app/(app)/home/page.tsx"
git commit -m "feat(home): pre-race hero prompting GC/jersey picks during the pre-race window"
```

---

### Task 3: Verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Static gates**

Run: `npx vitest run` → all pass (incl. `isPreRaceOpen`).
Run: `npx tsc --noEmit` → clean.
Run: `npm run lint` → clean (or no new violations in touched files).
Run: `npm run build` → succeeds.

- [ ] **Step 2: Scope check**

Run: `git diff --name-only main..HEAD` → only `docs/superpowers/…` (spec/plan) and the three `src/app/(app)/home/` files (`pre-race-open.ts`, `pre-race-open.test.ts`, `hero-pre-race.tsx`, `page.tsx`). No changes to `HeroNextStage`, `PreRaceCard`, queries, or tokens.

- [ ] **Step 3: Behavior reasoning check (documented, no runtime)**

Confirm by inspection: with the Tour active and `now` before `2026-07-04T15:05:00Z`, `isPreRaceOpen` → true → `HeroPreRace` renders with the three chips reflecting `gcPicks.length===5` / jersey presence; with `now` at/after that instant (or no stage 1), the existing `HeroNextStage` path renders unchanged. (Optional manual eyeball on the running app during the live pre-race window.)

---

## Self-Review

**Spec coverage:**
- Trigger = whole pre-race window, fail-closed → Task 1 (`isPreRaceOpen`) + Task 2 wiring (`preRaceOpen && stage1`). ✓
- Eyebrow + countdown + headline (done variant) + 3 Done/Missing chips + single `/picks` CTA (done variant) → Task 2 `HeroPreRace`. ✓
- Completion booleans from already-fetched data → Task 2 Step 2. ✓
- No new queries / tokens; `HeroNextStage` + `PreRaceCard` untouched; reuse existing `now` → Global Constraints + Task 2 (branches copied verbatim) + Task 3 scope check. ✓
- Testing: `isPreRaceOpen` unit + static gates → Tasks 1 & 3. ✓

**Placeholder scan:** No TBD/TODO; complete code + exact commands throughout.

**Type/name consistency:** `isPreRaceOpen(stage1StartIso, nowMs)`, `HeroPreRace({stage1StartIso, gcDone, pointsDone, youthDone})`, and the `gcDone/pointsDone/youthDone` names are identical across the helper, component, and page wiring. `Badge` tones (`ok`/`muted`) and `Countdown`/`fmtDate` signatures match the components verified in the codebase.
