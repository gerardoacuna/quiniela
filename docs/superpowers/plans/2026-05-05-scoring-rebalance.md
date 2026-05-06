# Scoring rebalance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance two scoring magnitudes pre-race: stage point table `[25,15,10,8,6,5,4,3,2,1]` → `[25,20,16,13,11,9,7,5,3,2]`, and per-jersey points `50` → `25` for both `points` and `white` kinds. No backfill needed (no published results yet).

**Architecture:** A single migration replaces `leaderboard_view` with new CASE values on both stage-scoring branches and `then 25` on jersey scoring. TypeScript constants land in one place (`src/lib/scoring/stage.ts`) — drop the two duplicates that exist in `stage-row.tsx` and `stage/[stageNumber]/page.tsx` so the values can never drift again. UI copy and tests follow.

**Tech Stack:** Supabase Postgres (view replacement), TypeScript, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-05-scoring-rebalance-design.md`.

---

## File Structure

**Create:**
- `supabase/migrations/20260505000010_giro_2026_scoring_rebalance.sql`

**Modify:**
- `src/lib/scoring/stage.ts` — flip the constant array values.
- `src/app/(app)/picks/stage-row.tsx` — drop inline duplicate; import canonical.
- `src/app/(app)/stage/[stageNumber]/page.tsx` — drop inline duplicate; import canonical.
- `src/app/(app)/picks/stage/[stageNumber]/form.tsx:192` — copy update.
- `src/app/(app)/picks/jerseys/[kind]/form.tsx:75` — copy update.
- `src/lib/scoring/stage.test.ts` — three assertions need new values.
- `src/lib/scoring/stage-row.test.ts` — two assertions need new values.
- `src/test/integration/admin-publish-final.test.ts` — two assertions need new values.
- `src/test/integration/leaderboard-jerseys.test.ts` — two assertions need new values.

**Delete:** none.

**Two commits total:** Task 1 = migration (DB layer, independent). Task 2 = all code + test changes (interlocking — split would leave `main` red between sub-commits).

---

## Task 1: Migration — replace `leaderboard_view`

**Files:**
- Create: `supabase/migrations/20260505000010_giro_2026_scoring_rebalance.sql`

- [ ] **Step 1.1: Write the migration**

Create `supabase/migrations/20260505000010_giro_2026_scoring_rebalance.sql` with the full view replacement. Stage CASE values become `25/20/16/13/11/9/7/5/3/2` (both UNION branches). Jersey magnitudes become `25` (both kinds). Everything else (gc_scoring CTE, stage_totals CTE, final select) is byte-for-byte identical to the previous migration `20260505000004_stage_picks_hedge_to_underdog.sql`.

```sql
-- Scoring rebalance for Giro 2026:
--   stage table 25/15/10/8/6/5/4/3/2/1 → 25/20/16/13/11/9/7/5/3/2
--   per-jersey points 50 → 25 (both 'points' and 'white' kinds)
-- No backfill needed (no published results yet); leaderboard_view recomputes on every read.

create or replace view public.leaderboard_view as
with
  stage_scoring as (
    -- primary stream
    select
      sp.user_id,
      s.edition_id,
      sp.stage_id,
      s.double_points,
      sr.position as finish_position,
      case sr.position
        when 1 then 25 when 2 then 20 when 3 then 16
        when 4 then 13 when 5 then 11 when 6 then 9
        when 7 then 7  when 8 then 5  when 9 then 3
        when 10 then 2
        else 0
      end as base_points
    from public.stage_picks sp
    join public.stages s
      on s.id = sp.stage_id
     and s.status = 'published'
     and s.counts_for_scoring
    left join public.stage_results sr
      on sr.stage_id = sp.stage_id
     and sr.rider_id = sp.rider_id
     and sr.status   = 'published'

    union all

    -- underdog stream
    select
      sp.user_id,
      s.edition_id,
      sp.stage_id,
      s.double_points,
      sr.position as finish_position,
      case sr.position
        when 1 then 25 when 2 then 20 when 3 then 16
        when 4 then 13 when 5 then 11 when 6 then 9
        when 7 then 7  when 8 then 5  when 9 then 3
        when 10 then 2
        else 0
      end as base_points
    from public.stage_picks sp
    join public.stages s
      on s.id = sp.stage_id
     and s.status = 'published'
     and s.counts_for_scoring
    left join public.stage_results sr
      on sr.stage_id = sp.stage_id
     and sr.rider_id = sp.underdog_rider_id
     and sr.status   = 'published'
    where sp.underdog_rider_id is not null
  ),
  stage_totals as (
    select
      user_id,
      edition_id,
      sum(case when double_points then base_points * 2 else base_points end)::int as stage_points,
      count(*) filter (where finish_position = 1)::int as exact_winners_count
    from stage_scoring
    group by user_id, edition_id
  ),
  gc_scoring as (
    select
      gp.user_id,
      gp.edition_id,
      sum(
        case
          when gp.rider_id = fc_exact.rider_id then 30
          when gp.rider_id in (
            select rider_id from public.final_classifications fc2
            where fc2.edition_id = gp.edition_id
              and fc2.kind = 'gc'
              and fc2.status = 'published'
          ) then 10
          else 0
        end
      )::int as gc_points
    from public.gc_picks gp
    left join public.final_classifications fc_exact
      on fc_exact.edition_id = gp.edition_id
     and fc_exact.kind       = 'gc'
     and fc_exact.position   = gp.position
     and fc_exact.status     = 'published'
    group by gp.user_id, gp.edition_id
  ),
  jersey_scoring as (
    select
      jp.user_id,
      jp.edition_id,
      sum(
        case
          when jp.kind = 'points' and fc_points.rider_id = jp.rider_id then 25
          when jp.kind = 'white'  and fc_white.rider_id  = jp.rider_id then 25
          else 0
        end
      )::int as jersey_points
    from public.jersey_picks jp
    left join public.final_classifications fc_points
      on fc_points.edition_id = jp.edition_id
     and fc_points.kind       = 'points_jersey'
     and fc_points.position   = 1
     and fc_points.status     = 'published'
    left join public.final_classifications fc_white
      on fc_white.edition_id  = jp.edition_id
     and fc_white.kind        = 'white_jersey'
     and fc_white.position    = 1
     and fc_white.status      = 'published'
    group by jp.user_id, jp.edition_id
  )
select
  p.id as user_id,
  p.display_name,
  e.id as edition_id,
  coalesce(st.stage_points, 0)        as stage_points,
  coalesce(gc.gc_points, 0)           as gc_points,
  coalesce(jp.jersey_points, 0)       as jersey_points,
  coalesce(st.stage_points, 0)
    + coalesce(gc.gc_points, 0)
    + coalesce(jp.jersey_points, 0)   as total_points,
  coalesce(st.exact_winners_count, 0) as exact_winners_count
from public.profiles p
cross join public.editions e
left join stage_totals st
  on st.user_id = p.id and st.edition_id = e.id
left join gc_scoring gc
  on gc.user_id = p.id and gc.edition_id = e.id
left join jersey_scoring jp
  on jp.user_id = p.id and jp.edition_id = e.id
where p.deleted_at is null
  and e.is_active;

grant select on public.leaderboard_view to authenticated;
```

- [ ] **Step 1.2: Apply locally**

Run: `npx supabase migration up`
Expected: `Applying migration 20260505000010_giro_2026_scoring_rebalance.sql...` followed by `Local database is up to date.`

- [ ] **Step 1.3: Apply to prod**

Run: `npx supabase db push --linked`
Expected: prompt confirms; `Applying migration 20260505000010_giro_2026_scoring_rebalance.sql...` followed by `Finished supabase db push.`

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260505000010_giro_2026_scoring_rebalance.sql
git commit -m "feat(db): rebalance scoring (stages 25/20/16/.../2, jerseys 25)"
```

---

## Task 2: Code + tests + UI copy (single bundled commit)

This task does many small edits, then commits once at the end. Splitting into per-file commits would leave `main` with broken tests between them (e.g., changing the constant before fixing the assertions).

**Files:**
- Modify: `src/lib/scoring/stage.ts`
- Modify: `src/app/(app)/picks/stage-row.tsx`
- Modify: `src/app/(app)/stage/[stageNumber]/page.tsx`
- Modify: `src/app/(app)/picks/stage/[stageNumber]/form.tsx`
- Modify: `src/app/(app)/picks/jerseys/[kind]/form.tsx`
- Modify: `src/lib/scoring/stage.test.ts`
- Modify: `src/lib/scoring/stage-row.test.ts`
- Modify: `src/test/integration/admin-publish-final.test.ts`
- Modify: `src/test/integration/leaderboard-jerseys.test.ts`

- [ ] **Step 2.1: Update the canonical TS constant**

In `src/lib/scoring/stage.ts`, replace:

```ts
export const STAGE_POINT_TABLE: readonly number[] = [25, 15, 10, 8, 6, 5, 4, 3, 2, 1] as const;
```

with:

```ts
export const STAGE_POINT_TABLE: readonly number[] = [25, 20, 16, 13, 11, 9, 7, 5, 3, 2] as const;
```

- [ ] **Step 2.2: DRY — drop the duplicate in `stage-row.tsx`, import canonical**

In `src/app/(app)/picks/stage-row.tsx`, replace the line:

```ts
const POINTS_TABLE = [25, 15, 10, 8, 6, 5, 4, 3, 2, 1];
```

with the import (add it alongside the other imports at the top of the file, then remove the inline constant):

```ts
import { STAGE_POINT_TABLE } from '@/lib/scoring';
```

Then update the one usage at line 37 from `POINTS_TABLE[position - 1]` to `STAGE_POINT_TABLE[position - 1]`.

- [ ] **Step 2.3: DRY — drop the duplicate in `stage/[stageNumber]/page.tsx`, import canonical**

In `src/app/(app)/stage/[stageNumber]/page.tsx`, replace the line:

```ts
const POINTS_TABLE = [25, 15, 10, 8, 6, 5, 4, 3, 2, 1];
```

with the import (add at top of file alongside existing imports):

```ts
import { STAGE_POINT_TABLE } from '@/lib/scoring';
```

Then update the two usages (lines 158 and 281) from `POINTS_TABLE[...]` to `STAGE_POINT_TABLE[...]`.

- [ ] **Step 2.4: Update stage-form copy**

In `src/app/(app)/picks/stage/[stageNumber]/form.tsx`, change line 192:

```tsx
? 'Top-10 finish scores 25/15/10/8/6/5/4/3/2/1.'
```

to:

```tsx
? 'Top-10 finish scores 25/20/16/13/11/9/7/5/3/2.'
```

- [ ] **Step 2.5: Update jersey-form copy**

In `src/app/(app)/picks/jerseys/[kind]/form.tsx`, change line 75:

```tsx
sub="50 pts if correct · 0 otherwise."
```

to:

```tsx
sub="25 pts if correct · 0 otherwise."
```

- [ ] **Step 2.6: Update `stage.test.ts` assertions**

In `src/lib/scoring/stage.test.ts`, three changes:

(a) The "10th place" test name and expectation:

Replace:

```ts
  it('awards 1 point for 10th place', () => {
    expect(stagePoints({ rider_id: 'r10' }, { double_points: false, status: 'published' }, results)).toBe(1);
  });
```

with:

```ts
  it('awards 2 points for 10th place', () => {
    expect(stagePoints({ rider_id: 'r10' }, { double_points: false, status: 'published' }, results)).toBe(2);
  });
```

(b) The doubled-stage `r5` expectation (P5 was 6 → 11; doubled 12 → 22):

Replace:

```ts
  it('doubles points on double_points stages', () => {
    expect(stagePoints({ rider_id: 'r1' }, { double_points: true, status: 'published' }, results)).toBe(50);
    expect(stagePoints({ rider_id: 'r5' }, { double_points: true, status: 'published' }, results)).toBe(12);
  });
```

with:

```ts
  it('doubles points on double_points stages', () => {
    expect(stagePoints({ rider_id: 'r1' }, { double_points: true, status: 'published' }, results)).toBe(50);
    expect(stagePoints({ rider_id: 'r5' }, { double_points: true, status: 'published' }, results)).toBe(22);
  });
```

(c) The point-table snapshot test (name and expectation):

Replace:

```ts
  it('STAGE_POINT_TABLE is 10 entries, descending from 25 to 1', () => {
    expect(STAGE_POINT_TABLE).toEqual([25, 15, 10, 8, 6, 5, 4, 3, 2, 1]);
  });
```

with:

```ts
  it('STAGE_POINT_TABLE is 10 entries, descending from 25 to 2', () => {
    expect(STAGE_POINT_TABLE).toEqual([25, 20, 16, 13, 11, 9, 7, 5, 3, 2]);
  });
```

- [ ] **Step 2.7: Update `stage-row.test.ts` assertions**

In `src/lib/scoring/stage-row.test.ts`, two cases need new sums.

(a) `'sums primary + underdog when both score'` (P3 was 10 → 16; P7 was 4 → 7; total was 14 → 23):

Replace:

```ts
  it('sums primary + underdog when both score', () => {
    expect(stageRowPoints({ rider_id: 'P3', underdog_rider_id: 'P7' }, STAGE, RESULTS))
      .toEqual({ primary: 10, underdog: 4, total: 14 });
  });
```

with:

```ts
  it('sums primary + underdog when both score', () => {
    expect(stageRowPoints({ rider_id: 'P3', underdog_rider_id: 'P7' }, STAGE, RESULTS))
      .toEqual({ primary: 16, underdog: 7, total: 23 });
  });
```

(b) `'doubles both contributions on a 2x stage'` (P1 doubled stays 50; P7 was 4×2=8 → 7×2=14; total was 58 → 64):

Replace:

```ts
  it('doubles both contributions on a 2x stage', () => {
    // P1 base=25, P7 base=4. Doubled: 50 + 8 = 58.
    expect(stageRowPoints({ rider_id: 'P1', underdog_rider_id: 'P7' }, STAGE_2X, RESULTS))
      .toEqual({ primary: 50, underdog: 8, total: 58 });
  });
```

with:

```ts
  it('doubles both contributions on a 2x stage', () => {
    // P1 base=25, P7 base=7. Doubled: 50 + 14 = 64.
    expect(stageRowPoints({ rider_id: 'P1', underdog_rider_id: 'P7' }, STAGE_2X, RESULTS))
      .toEqual({ primary: 50, underdog: 14, total: 64 });
  });
```

- [ ] **Step 2.8: Update `admin-publish-final.test.ts` assertions**

In `src/test/integration/admin-publish-final.test.ts`, two changes.

(a) Line 81 (single jersey hit): `50` → `25`. The surrounding test name says `awards 30 pts` which is stale even today (we're on `50`); leave the test name alone (separate cleanup, not in scope). Just the assertion:

Replace:

```ts
    expect(data?.[0]?.jersey_points).toBe(50);
```

with:

```ts
    expect(data?.[0]?.jersey_points).toBe(25);
```

(b) Line 119 (both jersey hits combined): `100` → `50`. The surrounding test name says `awards 50 pts (combined with points jersey 50)` — same staleness as (a). Update the assertion only:

Replace:

```ts
    expect(data?.[0]?.jersey_points).toBe(100);
```

with:

```ts
    expect(data?.[0]?.jersey_points).toBe(50);
```

- [ ] **Step 2.9: Update `leaderboard-jerseys.test.ts` assertions**

In `src/test/integration/leaderboard-jerseys.test.ts`, three changes.

(a) Test "awards 100 pts when both jersey picks match" → now awards 50. Update both the `it()` description and the expectation:

Replace:

```ts
  it('awards 100 pts when both jersey picks match published winners', async () => {
```

with:

```ts
  it('awards 50 pts when both jersey picks match published winners', async () => {
```

And replace:

```ts
    expect(data?.[0]?.jersey_points).toBe(100);
```

with:

```ts
    expect(data?.[0]?.jersey_points).toBe(50);
```

(b) Test "awards 50 pts when only one jersey matches" → now awards 25. Update both:

Replace:

```ts
  it('awards 50 pts when only one jersey matches', async () => {
```

with:

```ts
  it('awards 25 pts when only one jersey matches', async () => {
```

And replace:

```ts
    expect(data?.[0]?.jersey_points).toBe(50);
```

with:

```ts
    expect(data?.[0]?.jersey_points).toBe(25);
```

(c) Test "awards 0 pts when neither matches" — no change (0 stays 0).

- [ ] **Step 2.10: Lint + typecheck + vitest**

Run: `npm run lint && npm run typecheck && npx vitest run`
Expected: lint clean, typecheck clean, vitest reports `Test Files N passed | M skipped`. The integration suites stay skipped (no `SUPABASE_INTEGRATION=1`).

If anything fails, find the missed reference and fix it. Common gotcha: a stale `POINTS_TABLE` reference in a third file you didn't expect — `grep -rn "POINTS_TABLE" src` should now only return `STAGE_POINT_TABLE` matches plus the test file references.

- [ ] **Step 2.11: (Optional) Run integration tests against local Supabase**

If your local Supabase is up:

Run: `SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/leaderboard-jerseys.test.ts src/test/integration/admin-publish-final.test.ts`
Expected: PASS — assertions match the new magnitudes against the locally-applied migration.

If Supabase isn't running locally, skip — the typecheck pass already proves the code wires together; the migration is already on prod.

- [ ] **Step 2.12: Commit + push**

```bash
git add \
  src/lib/scoring/stage.ts \
  src/lib/scoring/stage.test.ts \
  src/lib/scoring/stage-row.test.ts \
  "src/app/(app)/picks/stage-row.tsx" \
  "src/app/(app)/stage/[stageNumber]/page.tsx" \
  "src/app/(app)/picks/stage/[stageNumber]/form.tsx" \
  "src/app/(app)/picks/jerseys/[kind]/form.tsx" \
  src/test/integration/admin-publish-final.test.ts \
  src/test/integration/leaderboard-jerseys.test.ts
git commit -m "feat(scoring): apply stage 25/20/.../2 + jersey 25 magnitudes; DRY duplicates"
git push origin main
```

Vercel auto-deploys from `main`. The leaderboard view is already on prod (Task 1) so the deploy is purely UI/copy/test reflection of the same change.

---

## Done criteria

1. `leaderboard_view` in prod returns the new stage table values (both primary and underdog branches) and `25` per jersey kind.
2. Single canonical `STAGE_POINT_TABLE` import everywhere — no duplicates remain (`grep -rn "POINTS_TABLE = " src` returns no inline definitions).
3. UI copy on stage form and jersey form reflects the new numbers.
4. `npm run lint && npm run typecheck && npx vitest run` all pass.
5. Vercel deploy reaches `Ready` after the push.
