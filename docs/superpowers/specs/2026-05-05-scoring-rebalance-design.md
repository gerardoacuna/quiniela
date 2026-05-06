# Scoring rebalance — Design

**Date:** 2026-05-05
**Status:** Draft, awaiting user review

## Goal

Rebalance two scoring magnitudes before the race starts:

1. **Per-stage point table:** `[25, 15, 10, 8, 6, 5, 4, 3, 2, 1]` (sum 79) → `[25, 20, 16, 13, 11, 9, 7, 5, 3, 2]` (sum 131). Same ten positions score; per-position rewards across P2–P10 increase to make middle-of-the-top-10 finishes meaningfully more valuable.
2. **Per-jersey points (points + white):** `50` per correct pick → `25` per correct pick. Halves jersey weight; both kinds together cap at 50 (was 100), keeping pre-race picks important but not dominant relative to per-stage points.

## Decisions

| | |
|---|---|
| Backfill / recompute | None needed. Race hasn't started; no published results; `leaderboard_view` recomputes on every read. |
| Doubled stages (7, 16, 17, 19, 20) | Multiplier unchanged. P1 cap stays at 25 × 2 = 50. P10 grows from 1×2=2 to 2×2=4. |
| Underdog stream | New stage table also applies to the UNION ALL underdog branch in `leaderboard_view`. Hedge picks score by the same table. |
| Tiebreaker `exact_winners_count` | Unchanged (independent of point magnitudes). |
| Code duplication clean-up | Bundle in: drop the two duplicated `POINTS_TABLE` constants in `stage-row.tsx` and `stage/[stageNumber]/page.tsx`; both import the single canonical `STAGE_POINT_TABLE` from `@/lib/scoring`. |

## Architecture

Three layers change:

1. **`leaderboard_view`** — `create or replace` migration with new CASE statements on both UNION ALL branches (primary + underdog) and `then 25` for both jersey kinds.
2. **TS constants** — single source of truth in `src/lib/scoring/stage.ts`; consumers import.
3. **UI copy** — two static strings reflecting the new numbers.

Tests follow: unit tests under `src/lib/scoring/` and integration tests under `src/test/integration/` with assertions tied to the old magnitudes get updated.

## Section 1 — Database migration

`supabase/migrations/20260505000010_giro_2026_scoring_rebalance.sql`:

```sql
-- Scoring rebalance for Giro 2026:
--   stage table 25/15/10/8/6/5/4/3/2/1 → 25/20/16/13/11/9/7/5/3/2
--   per-jersey points 50 → 25 (both 'points' and 'white' kinds)
-- No backfill needed (no published results yet).

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
    -- unchanged from previous view; copy verbatim from the prior migration
    ...
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
  -- final select unchanged from previous view; copy verbatim
  ...
;

grant select on public.leaderboard_view to authenticated;
```

The `gc_scoring` CTE and the final `select … from public.profiles … cross join public.editions … left join …` block are unchanged. The implementer copies them verbatim from the most recent `create or replace view public.leaderboard_view` migration (`20260505000004_stage_picks_hedge_to_underdog.sql`); the only meaningful diff between the two migrations is the `stage_scoring` CASE values (both branches) and the `then 25` jersey magnitudes (was `then 50`). The plan will spell out the full SQL so the implementer doesn't need to reconstruct.

## Section 2 — TypeScript constants

`src/lib/scoring/stage.ts`:

```ts
export const STAGE_POINT_TABLE: readonly number[] = [25, 20, 16, 13, 11, 9, 7, 5, 3, 2] as const;
```

`src/app/(app)/picks/stage-row.tsx`:

```ts
// Top of file: replace the inline `const POINTS_TABLE = [...]` with an import.
import { STAGE_POINT_TABLE } from '@/lib/scoring';
// Below, references to POINTS_TABLE become STAGE_POINT_TABLE.
```

`src/app/(app)/stage/[stageNumber]/page.tsx`:

```ts
// Same DRY: replace the inline POINTS_TABLE with an import.
import { STAGE_POINT_TABLE } from '@/lib/scoring';
```

The duplicate-removal lands in the same task as the value change so we don't ship two copies briefly with mismatched values.

## Section 3 — UI copy

`src/app/(app)/picks/stage/[stageNumber]/form.tsx:192`:

```tsx
? 'Top-10 finish scores 25/20/16/13/11/9/7/5/3/2.'
```

`src/app/(app)/picks/jerseys/[kind]/form.tsx:75`:

```tsx
sub="25 pts if correct · 0 otherwise."
```

No other UI strings reference the old numbers.

## Section 4 — Tests

### Unit tests

`src/lib/scoring/stage.test.ts`:

- `it('awards 1 point for 10th place', ...)` → `it('awards 2 points for 10th place', ...)`; expectation `1` → `2`.
- `it('doubles points on double_points stages', ...)`: `r1` doubled stays `50`; `r5` doubled was `12` (=6×2) → `22` (=11×2).
- `it('STAGE_POINT_TABLE is 10 entries, descending from 25 to 1', ...)` → `'…descending from 25 to 2'`; expectations updated.
- Any other tests asserting specific values get updated to match the new table.

`src/lib/scoring/stage-row.test.ts`:

- `'sums primary + hedge when both score'`: P3 (was 10) + P7 (was 4) = 14 → 16 + 7 = **23**.
- `'doubles both contributions on a 2x stage'`: P1 doubled stays 50; P7 (was 4) doubled was 8 → P7 (now 7) doubled = 14. Total: 50 + 14 = **64**.
- (The "primary only when underdog null" and "neither scores" cases don't reference the magnitudes.)

### Integration tests (Supabase-gated)

`src/test/integration/admin-publish-final.test.ts`:

- `expect(data?.[0]?.jersey_points).toBe(50)` → `.toBe(25)`.
- `expect(data?.[0]?.jersey_points).toBe(100)` → `.toBe(50)` (combined points + white).

`src/test/integration/leaderboard-jerseys.test.ts`:

- `100` → `50` (both jerseys hit).
- `50` → `25` (only one jersey hits).
- `0` → still `0` (neither hit).

## Section 5 — Rollout

Race hasn't started, no published results exist, no real participants have made scoring-affected picks yet (only the test pick). Order of operations:

1. Apply the migration locally (`supabase migration up`). No `db:types` regen needed — view replacement doesn't change the table schema or the view's column shape (only the values).
2. Apply to prod (`supabase db push --linked`).
3. Push the code change (Vercel auto-deploys).
4. No coordination, no announcement, no backfill.

If results were published, the rebalance would still be safe — `leaderboard_view` recomputes on every read; existing rows in `stage_results`/`stage_picks` aren't touched. But there are none, so this concern is hypothetical.

## Out of scope

- Changing the **GC** scoring (30 / 10 / 0 unchanged).
- Adding new jersey kinds (KOM/blue jersey).
- Changing the doubling multiplier or which stages are doubled.
- Backfilling historical scores (none exist).

## Done criteria

1. Leaderboard view returns the new stage table values for both primary and underdog scoring streams.
2. Jersey scoring returns 25 per correct pick (both kinds), 50 max.
3. TS constant exported from one place; both consumers import it.
4. UI copy reflects the new numbers in stage form and jersey form.
5. Lint, typecheck, vitest all green.
