# Home hero — show underdog pick — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the underdog pick alongside the primary on the home page's next-stage hero. Pure UI change — no data, query, or test changes.

**Architecture:** `HeroNextStage` gets a richer `HeroPick` type (`{primary, underdog}` instead of `{rider} | null`) and renders two stacked rows via a small extracted `HeroPickRow` helper. `home/page.tsx` passes both fields. `getHomeData` already returns `underdog_rider` after the FK-disambiguation fix, so no data layer change is needed.

**Tech Stack:** React 19 / Next.js 16 App Router, TypeScript, design-system inline styles.

**Reference spec:** `docs/superpowers/specs/2026-05-05-home-hero-underdog-design.md`.

---

## File Structure

**Modify (only these two):**
- `src/app/(app)/home/hero-next-stage.tsx` — type, internal `HeroPickRow`, render two rows, CTA copy.
- `src/app/(app)/home/page.tsx` — pass `{primary, underdog}` instead of `{rider}|null`.

**Create:** none.
**Delete:** none.
**Tests:** none added (matches spec — no per-component snapshots in this codebase, and this change has no integration-test surface).

These two changes are interlocking: the prop type changes in file 1 break file 2's call site. They land in a single commit.

---

## Task 1: Update `HeroNextStage` (type, row component, render, CTA)

**Files:**
- Modify: `src/app/(app)/home/hero-next-stage.tsx`

- [ ] **Step 1.1: Replace the `HeroPick` type**

In `src/app/(app)/home/hero-next-stage.tsx`, replace:

```ts
export type HeroPick = {
  rider: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
  };
} | null;
```

with:

```ts
export type HeroPickRider = {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
};

export type HeroPick = {
  primary: HeroPickRider | null;
  underdog: HeroPickRider | null;
};
```

The outer `HeroPick` is no longer nullable. Both inner fields can be `null` to signal "no rider saved for this slot."

- [ ] **Step 1.2: Replace the single-pick render block with two `HeroPickRow` calls**

In the same file, find the block (currently lines 125-189) that starts with `<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>` and contains the `pick ? ... : ...` conditional. Replace the inner `{pick ? (...) : (...)}` JSX with two stacked rows:

```tsx
<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
  <HeroPickRow kind="primary" rider={pick.primary} />
  <HeroPickRow kind="underdog" rider={pick.underdog} />
</div>
```

(Keep the outer `<StageProfile ... />` sibling and the wrapping `<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>` — only the right-of-profile column changes.)

- [ ] **Step 1.3: Add the `HeroPickRow` component at the bottom of the file**

Append (after the existing `HeroNextStage` export) a private (un-exported) component:

```tsx
function HeroPickRow({ kind, rider }: { kind: 'primary' | 'underdog'; rider: HeroPickRider | null }) {
  const label = kind === 'primary' ? 'PRIMARY' : 'UNDERDOG';

  if (rider) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BibTile num={rider.bib} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 10,
            letterSpacing: 1.2,
            color: 'var(--ink-mute)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
          }}>
            {label}
          </div>
          <div style={{
            fontWeight: 600,
            fontSize: 15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {rider.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamChip team={rider.team} size={10} />
            <span>{rider.team ?? ''}</span>
          </div>
        </div>
      </div>
    );
  }

  const headline = kind === 'primary' ? 'No rider yet' : 'No underdog yet';
  const sub = kind === 'primary' ? "You're missing points." : 'Optional hedge for the same stage.';
  const headlineColor = kind === 'primary' ? 'var(--accent)' : 'var(--ink)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 34,
        height: 40,
        border: '1.5px dashed var(--accent)',
        borderRadius: 2,
        display: 'grid',
        placeItems: 'center',
        color: 'var(--accent)',
      }}>
        ?
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10,
          letterSpacing: 1.2,
          color: 'var(--ink-mute)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
        }}>
          {label}
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, color: headlineColor }}>
          {headline}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {sub}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 1.4: Update the CTA copy**

Find the line in the existing CTA Link (around line 212):

```tsx
{pick ? 'Change pick' : 'Pick a rider'} →
```

Replace with:

```tsx
{(pick.primary || pick.underdog) ? 'Change picks' : 'Make picks'} →
```

(`pick` is no longer nullable, so the truthy-check shifts to the inner fields.)

---

## Task 2: Update `home/page.tsx` to pass the new shape

**Files:**
- Modify: `src/app/(app)/home/page.tsx`

- [ ] **Step 2.1: Update the `<HeroNextStage>` invocation**

In `src/app/(app)/home/page.tsx`, find the invocation (currently lines 137-141):

```tsx
<HeroNextStage
  stage={nextStage}
  pick={myPickForNext ? { rider: myPickForNext.riders } : null}
  nextStageHref={`/picks/stage/${nextStage.number}`}
  stageHref={`/stage/${nextStage.number}`}
/>
```

Replace with:

```tsx
<HeroNextStage
  stage={nextStage}
  pick={{
    primary: myPickForNext?.riders ?? null,
    underdog: myPickForNext?.underdog_rider ?? null,
  }}
  nextStageHref={`/picks/stage/${nextStage.number}`}
  stageHref={`/stage/${nextStage.number}`}
/>
```

No cast needed: `home.ts` already exposes the aliased `underdog_rider` relation in the inferred row type, as proven by line 89 of the same file (`if (p.underdog_rider_id && p.underdog_rider)` works without a cast).

---

## Task 3: Verify and commit (bundled)

**Files:** none modified — verification + commit only.

- [ ] **Step 3.1: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS — no errors. If the cast in Step 2.1 is unnecessary because TypeScript already infers `underdog_rider`, drop it now and re-run.

- [ ] **Step 3.2: Run tests**

Run: `npm test`
Expected: PASS — no test changes were made; this confirms nothing else broke.

- [ ] **Step 3.3: Visual sanity in dev server (optional but recommended)**

Run: `npm run dev`
Visit `/home` (with `.env.local` populated for local Supabase) and confirm:
- Hero shows two rows: PRIMARY (with rider info or empty placeholder) and UNDERDOG (with rider info or empty placeholder).
- CTA reads `Make picks →` when both are empty, `Change picks →` otherwise.
- Tap-target behavior is unchanged.

If `.env.local` isn't populated for local Supabase, skip — the typecheck pass already confirms the prop wiring compiles, and we've shipped these UI files plenty of times without local-Supabase verification.

- [ ] **Step 3.4: Commit (bundled)**

```bash
git add "src/app/(app)/home/hero-next-stage.tsx" "src/app/(app)/home/page.tsx"
git commit -m "$(cat <<'EOF'
feat(home): hero shows underdog pick alongside primary

HeroPick is now {primary, underdog} (each nullable) and the hero
renders two stacked rows via a small HeroPickRow helper. CTA copy
goes plural to reflect that both picks live behind the same form.

Pure UI; no query change (getHomeData already returns underdog_rider
after the FK-disambiguation fix).
EOF
)"
```

---

## Done criteria

1. Hero shows two stacked rows: PRIMARY and UNDERDOG, each filled or empty per saved state.
2. Empty-state copy is per-kind (primary urgent accent, underdog neutral).
3. CTA reads `Change picks` when at least one pick exists, `Make picks` otherwise.
4. Lint, typecheck, vitest all green.
5. No data-layer changes.
