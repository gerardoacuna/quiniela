# Design: 4th & 5th place pre-race picks (GC Top 5)

**Date:** 2026-06-28
**Status:** Approved (design)

## Goal

Add 4th place and 5th place to the pre-race GC picks. Each new pick awards the
**same points as the points/youth jerseys** — currently **25 points**, exact
match only, no partial credit.

## Background: current scoring (live values)

The authoritative scoring is the leaderboard SQL view, last redefined in
`supabase/migrations/20260505000011_gc_scoring_rebalance.sql`:

- **Jerseys** (`points`, `white`): 25 points each, exact match only.
- **GC top 3**: 50 points for the exact position; 25 points if the picked rider
  finished in the actual top 3 but at a different position.

Note: `src/lib/scoring/jersey.ts` still declares `JERSEY_POINTS = 50`. This has
drifted from the live SQL view (25) and is fixed as part of this work (see
"Drift fix" below). The white jersey is the young-rider / youth jersey.

## Scoring model for 4th & 5th

- **4th place:** 25 points if the picked rider finished exactly 4th, else 0.
- **5th place:** 25 points if the picked rider finished exactly 5th, else 0.
- **No partial credit** for 4th/5th.
- Existing **top-3 partial credit is unchanged** and stays scoped to positions
  1–3 only. Extending the data to 5 finishers must NOT widen the partial-credit
  "podium" set to top-5.

Resulting GC section max: 50×3 + 25×2 = **200 points** (was 150).

## Data model — extend existing tables (no new tables/enums)

- `gc_picks.position` check constraint: `between 1 and 3` → `between 1 and 5`
  (originally `supabase/migrations/20260417000003_game_tables.sql:19`).
- `final_classifications` GC constraint
  (`supabase/migrations/20260417000003_game_tables.sql:51`):
  `(kind = 'gc' and position between 1 and 3)` → `between 1 and 5`. Admin
  publishes the actual 4th & 5th finishers here.

Both changes via a new forward migration (do not edit historical migrations).

## Scoring implementation — two spots, same rule

### 1. SQL leaderboard view (new migration redefining the view)

Follow the established pattern: a new migration that `create or replace`s the
whole leaderboard view, copied from `20260505000011` with these `gc_scoring`
changes:

- Exact match (`gp.rider_id = fc_exact.rider_id`): award `50` when
  `gp.position between 1 and 3`, award `25` when `gp.position between 4 and 5`.
- Partial-credit subquery (currently lines 76–81): add
  `and fc2.position between 1 and 3` so the "in podium" set stays top-3 even
  though `final_classifications` now holds 5 GC rows.

`jersey_scoring` and `stage_scoring` carry over unchanged (still 25 per jersey).

### 2. `src/lib/scoring/gc.ts`

Rewrite `gcPoints` so partial credit is scoped to positions ≤3:

```ts
export function gcPoints(picks, actual) {
  if (actual.length === 0) return 0;
  const podium = new Set(
    actual.filter(a => a.position <= 3).map(a => a.rider_id)
  );
  const exactByPos = new Map(actual.map(a => [a.position, a.rider_id]));
  let total = 0;
  for (const pick of picks) {
    const exact = exactByPos.get(pick.position) === pick.rider_id;
    if (exact) {
      total += pick.position <= 3 ? 50 : 25;
    } else if (pick.position <= 3 && podium.has(pick.rider_id)) {
      total += 25;
    }
  }
  return total;
}
```

## Player-facing form — `src/app/(app)/picks/gc/form.tsx`

- Expand from 3 rider selectors to 5.
- Title "GC Top 3" → "GC Top 5".
- Distinctness validation extends to all 5 (no rider reused across slots).
- Scoring copy updated to describe both tiers:
  - slots 1–3: 50 pts exact position · 25 pts right rider, wrong top-3 slot
  - slots 4–5: 25 pts exact position only
  - update the `sub` line (currently `form.tsx:119`) and the scoring footnote
    block (`form.tsx:226–230`), including the "Scoring max 150 pts" → 200.

## Validation / server action — `src/lib/actions/picks.ts`

- `submitGcPicks` schema: accept positions 1–5 (5 entries) instead of 3.
- Validate 5 distinct riders.
- Upsert positions 1–5.
- Lock timing (Stage 1 start, `edition_started()`) unchanged.

## Admin — publish 4th & 5th finishers

- `src/app/admin/classifications/form.tsx`: the "GC top 3" section becomes 5
  rows (add 4th, 5th).
- `src/lib/actions/admin-final.ts` (`publishFinal`): insert GC positions 1–5
  into `final_classifications` (currently inserts 1–3).

## Read-only display surfaces (Top 3 → Top 5)

Each renders GC picks and must handle 5 rows plus minor layout for two extra
rows. Mostly iterate 1–5 instead of 1–3:

- `src/app/(app)/home/pre-race-card.tsx`
- `src/app/(app)/picks/pre-race-strip.tsx` (the "GC Top 3" column → "Top 5")
- `src/app/(app)/me/page.tsx`
- `src/app/(app)/board/everyones-jerseys.tsx` and `src/lib/queries/board-gc.ts`
  (board GC view)

## Types

`gc_picks` / `final_classifications` Row types in `src/lib/types/database.ts`
are position-based (`position: number`) — no enum change needed. Verify they
still match after the constraint change; regenerate if the project regenerates
DB types.

## Drift fix (requested)

- `src/lib/scoring/jersey.ts`: `JERSEY_POINTS = 50` → `25` to match the live
  SQL view. (Only runtime consumer is its own test; the jersey form copy
  already says "25 pts".)
- `src/lib/scoring/jersey.test.ts`: update `toBe(50)` assertions to `25`.

## Testing

- `src/lib/scoring/gc.test.ts`: add cases —
  - exact 4th = 25; exact 5th = 25
  - 4th-pick rider finishes 5th = 0 (no partial credit for 4/5)
  - top-3 partial credit unchanged when 4th/5th finishers are present in
    `actual` (regression guard for the podium-set scoping)
- `src/lib/scoring/jersey.test.ts`: assertions updated to 25.
- Leaderboard integration test (`src/test/integration/`): extend GC fixture to
  5 positions; assert GC section totals include 4th/5th at 25.
- Form/action: 5 distinct riders accepted; duplicate rider rejected.

## Out of scope (YAGNI)

- No change to top-3 scoring values, jersey scoring values, or stage scoring.
- No new pick categories beyond 4th/5th.
- No separate tables or enum values.
