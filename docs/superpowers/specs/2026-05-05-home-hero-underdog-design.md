# Home hero — show underdog pick — Design

**Date:** 2026-05-05
**Status:** Draft, awaiting user review

## Goal

Surface the underdog pick on the home page's next-stage hero, alongside the primary pick. Today the hero shows only the primary; players have to navigate to `/picks/stage/N` to see whether they've also saved an underdog. Closing this gap puts both picks for the upcoming stage one glance away.

## Decisions

| | |
|---|---|
| When does the underdog row appear? | Always, mirroring `/picks/stage/N` and `/picks` index. Empty underdog renders a dashed-? placeholder so the row is consistent with primary. |
| Layout | Vertical: PRIMARY row on top, UNDERDOG row below. Side-by-side cramps name/team on mobile. |
| CTA | Single existing button still goes to `/picks/stage/N` (which has the Primary/Underdog toggle). Copy goes plural: `"Change picks"` / `"Make picks"`. |
| Backend / queries | No change. `getHomeData` already returns `underdog_rider` (since the FK-disambiguation fix). Pure UI. |
| Tests | No new tests — the codebase doesn't snapshot per-component, and the bug class that would justify a render test (the recent FK ambiguity) needs an integration test, not a snapshot. |

## Architecture

The hero is the only file that meaningfully changes. Two small touch-points:

1. `src/app/(app)/home/hero-next-stage.tsx` — `HeroPick` type goes from `{ rider } | null` to `{ primary, underdog }` (both nullable). Render replaces the single pick block with two stacked rows reusing the same row component.
2. `src/app/(app)/home/page.tsx` — pass both fields to the hero.

No data layer change. No tests added.

## Section 1 — Type change

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

The outer `HeroPick` is no longer nullable — `pick` is always passed (one row always renders for primary, one for underdog). Either inner field may be `null` to signal the empty state.

## Section 2 — Render

The current single rider block is extracted into a small inline component used twice. Pseudo-shape:

```tsx
function HeroPickRow({ kind, rider }: { kind: 'primary' | 'underdog'; rider: HeroPickRider | null }) {
  const label = kind === 'primary' ? 'PRIMARY' : 'UNDERDOG';
  if (rider) {
    // bib + name + team chip + team name (today's filled rendering, with kind label)
  } else {
    const sub = kind === 'primary'
      ? "You're missing points."
      : 'Optional hedge for the same stage.';
    // dashed-? placeholder with kind label, "No <rider|underdog> yet" headline, and sub copy
  }
}
```

Two `<HeroPickRow>` calls inside the existing right-of-stage-profile column, separated by the existing `<div>` gap.

The kind label replaces the current "Your pick" eyebrow (the kind itself answers "your what").

## Section 3 — Page wiring

`src/app/(app)/home/page.tsx`:

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

`myPickForNext` already fans out to both fields after the recent FK fix; this is just plumbing.

## Section 4 — CTA copy

Existing: `"Change pick" | "Pick a rider"`. New (plural):

```ts
const hasAnyPick = pick.primary !== null || pick.underdog !== null;
{hasAnyPick ? 'Change picks' : 'Make picks'} →
```

`"Make picks"` reads better than `"Pick riders"` because the underdog is optional — players don't always pick two.

## Section 5 — Empty-state copy

| Slot | Headline | Sub |
|---|---|---|
| Primary, empty | `No rider yet` | `You're missing points.` (today's copy) |
| Underdog, empty | `No underdog yet` | `Optional hedge for the same stage.` |

The headline color stays accent for primary (today's behavior — it's the urgent one). Underdog headline uses `--ink` (less alarming — it's optional).

## Out of scope

- Surfacing underdog on the timeline strip below the hero (just stage tiles; no rider info).
- Pre-race surfaces (GC / jerseys card already exists separately).
- Any backend or query change.

## Done criteria

1. Hero shows two rows: PRIMARY and UNDERDOG, each filled or empty.
2. Page passes both rider fields from `myPickForNext`.
3. CTA copy reflects the plural intent.
4. Lint, typecheck, vitest stay green (no test changes needed).
