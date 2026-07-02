# Design: Home pre-race hero

**Date:** 2026-07-02
**Status:** Approved (design)

## Goal

During the pre-race window, the Home hero should invite users to make their
pre-race picks (GC Top 5 + Points jersey + Youth jersey) instead of jumping to a
stage's pick prompt. Once pre-race picks lock (stage 1 start), the hero reverts
to the existing next-stage behavior.

## Background / why it's wrong today

`src/app/(app)/home/page.tsx` computes the hero stage from **counted stages only**
(`const stages = data.stages.filter(s => s.counts_for_scoring)`). For the Tour,
stages 1–2 aren't counted, so the "next stage" resolves to **stage 3** and the
hero shows "Stage 3 · Make picks" even though the race hasn't started and pre-race
picks are the actual next action. Pre-race picks (GC Top 5, both jerseys) lock at
**stage 1 start** and are edition-wide, not tied to a counted stage. A detailed
`PreRaceCard` already exists lower on the page (it lists the picked riders); only
the hero needs to change.

## Approach

A new, separate `HeroPreRace` component (not an overload of `HeroNextStage`, which
stays single-purpose for stages). Home renders exactly one hero:
`preRaceOpen ? <HeroPreRace/> : <HeroNextStage/>`.

## Components / changes

### 1. Pure helper — `src/app/(app)/home/pre-race-hero.ts` (or colocated)
- `export function isPreRaceOpen(stage1StartIso: string | null | undefined, nowMs: number): boolean`
  — returns `true` iff `stage1StartIso` is present and `nowMs < Date.parse(stage1StartIso)`. Null/undefined/invalid → `false` (fail closed → next-stage hero). Unit-tested.

### 2. `src/app/(app)/home/hero-pre-race.tsx` (new, presentational)
Same section shell as `HeroNextStage` (surface bg, `--hair` border, `--radius`, the accent-corner blob). Contents:
- **Eyebrow:** `Pre-race · locks {fmtDate(stage1StartIso)}` (mono, `--ink-mute`), with a `<Countdown iso={stage1StartIso}/>` (reuse `@/components/design/countdown`) in the top-right, mirroring the next-stage hero.
- **Headline** (`--font-display`, size ~40): `Make your pre-race picks`; when all three are done → `Pre-race picks locked in`.
- **Three status chips** — `GC Top 5`, `Points jersey`, `Youth jersey` — each rendered from a boolean: **Done** (a `Badge tone="ok"` / check styling) or **Missing** (a `Badge tone="outline"` muted styling). Use the existing `Badge` component tones; no new tokens.
- **Primary CTA** (`Link`, accent button, same style as the next-stage hero's primary CTA) → `/picks`; label `Make pre-race picks →`, switching to `Review pre-race picks →` when all three are done.

Props: `{ stage1StartIso: string; gcDone: boolean; pointsDone: boolean; youthDone: boolean }`.

### 3. `src/app/(app)/home/page.tsx` wiring
- Find stage 1 from the **unfiltered** list: `const stage1 = data.stages.find(s => s.number === 1) ?? null;`
- `const preRaceOpen = isPreRaceOpen(stage1?.start_time, Date.now());`
- Completion from data already fetched on the page:
  `const gcDone = gcPicks.length === 5;`
  `const pointsDone = jerseyPicks.points != null;`
  `const youthDone = jerseyPicks.white != null;`
- Render: when `preRaceOpen` (and `stage1` exists), render `<HeroPreRace stage1StartIso={stage1.start_time} gcDone={gcDone} pointsDone={pointsDone} youthDone={youthDone}/>`; otherwise the existing `nextStage ? <HeroNextStage…/> : "All stages complete."` block, unchanged.
- The GC/jersey queries already run on this page — reuse their results; move their computation above the hero render if needed (they are currently computed before the return, so `gcPicks`/`jerseyPicks` are already in scope). No new queries.

## Data notes

- `data.stages` is the full stage list for the edition (the counted subset is derived from it), so stage 1 is available even though it's not counted. Confirm during implementation that `getHomeData` returns all stages (if it pre-filters, widen it to include stage 1's `start_time`).
- GC "done" = exactly 5 rows (a full Top-5 slate), matching the submit rule (5 distinct). Jersey "done" = a row exists for that kind.

## Testing

- Unit: `isPreRaceOpen` — before stage-1 start → true; at/after start → false; null/invalid → false.
- `tsc` + `npm run build` green. Components are presentational; the Home route is auth-gated (no anon curl check), so verification is static + reasoning. Optional: a manual eyeball while the Tour pre-race window is open (today) confirms the hero shows the pre-race prompt with correct chip states, and that flipping `now` past stage-1 start (or after lock) restores the next-stage hero.

## Out of scope (YAGNI)

- No change to `HeroNextStage` or the post-lock next-stage behavior (still shows the first counted upcoming stage).
- No change to the bottom `PreRaceCard` (keeps listing picked riders).
- No new design tokens; reuse `Badge`, `Countdown`, and the existing hero shell styles.
- No per-jersey deep-links from the hero (single CTA to `/picks`, which already surfaces each category).
