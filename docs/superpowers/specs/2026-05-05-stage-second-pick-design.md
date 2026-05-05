# Stage second pick (underdog) — Design

**Date:** 2026-05-05
**Status:** Draft, awaiting user review

## Goal

Add an optional second rider pick per counted stage, intended as a underdog. The second pick is restricted to riders that admins haven't flagged as "top tier", uses the same point table as the first pick, and contributes to a user's total additively. The pool of riders a user can spend across primary + underdog picks is shared (one rider, one slot, ever).

## Decisions (Q&A summary)

| | |
|---|---|
| Eligibility ("not top 20") | Admin-flagged `is_top_tier boolean not null default false` on `riders`. No bib fallback. Feature dormant until admins flag riders. |
| Uniqueness | Total: a rider can be a primary OR a underdog OR neither, exactly once across all counted stages in an edition. |
| Scoring combination | Additive — both picks score independently using the same point table (25/15/10/8/6/5/4/3/2/1) and `double_points` multiplier. |
| Per-stage required? | First pick required, second pick optional. |
| UI | Toggle (segmented control: Primary / Underdog) on `/picks/stage/[n]`, single Save button. |
| Lock timing | Same as first pick (stage start time). |
| Visibility | Same as primary — underdog picks become visible to other players after lock. |
| Tiebreaker | Symmetric: `exact_winners_count` ticks on a underdog P1 hit (still capped at 1 per stage since one rider holds P1). |
| Cancelled stages | No score, no slot burn — same rule as primary today. |

## Architecture

Underdog is a sibling column on `stage_picks`, not a peer row. The relationship is asymmetric (primary required, underdog optional and attached to a primary), unlike jerseys where Points and White are independent peers. One row per `(user, stage)`; underdog is a nullable foreign key.

Cross-stage / cross-pool uniqueness stays application-enforced via the existing `validateNoReuse` helper, with the adapter flattening each row into 1–2 `ExistingPick` entries before validation. No new DB unique constraints.

The leaderboard view extends its `stage_scoring` CTE to UNION ALL the two streams (primary join + underdog join) so `stage_totals` continues to sum and `count(*) filter (...)` over them naturally.

## Section 1 — Data model

### `riders`

Add nullable-to-storage but non-nullable-by-default boolean:

```sql
alter table public.riders
  add column is_top_tier boolean not null default false;
```

Effective underdog eligibility: `not is_top_tier`. Primary picks ignore this flag (today's behavior preserved).

### `stage_picks`

Add nullable underdog column + within-row check:

```sql
alter table public.stage_picks
  add column underdog_rider_id uuid references public.riders(id),
  add constraint stage_picks_primary_ne_underdog
    check (underdog_rider_id is null or underdog_rider_id != rider_id);
```

The existing `unique (user_id, stage_id)` is preserved — still one row per (user, stage).

Cross-stage uniqueness is enforced in the action layer (see Section 3); no DB constraint added for that.

### TypeScript regeneration

```
npm run db:types
```

Regenerates `src/lib/types/database.ts` with the new columns.

## Section 2 — Scoring

### `stagePoints` (unchanged)

Stays a single-rider function. No new responsibility. Existing tests stay valid.

### Call-site helper `stageRowPoints`

A small adapter at the call sites (used by `/me`, `/home` recent-picks, `/picks` row rendering):

```ts
function stageRowPoints(
  pick: { rider_id: string; underdog_rider_id: string | null },
  stage: StageMeta,
  results: readonly StageResult[],
): { primary: number; underdog: number; total: number } {
  const primary = stagePoints({ rider_id: pick.rider_id }, stage, results);
  const underdog = pick.underdog_rider_id
    ? stagePoints({ rider_id: pick.underdog_rider_id }, stage, results)
    : 0;
  return { primary, underdog, total: primary + underdog };
}
```

Lives in `src/lib/scoring/stage-row.ts`. Returns the breakdown so the UI can show separate per-pick badges.

### `leaderboard_view`

Replace the `stage_scoring` CTE to UNION ALL the two scoring streams. The downstream `stage_totals` CTE doesn't change — `sum(...)` and `count(*) filter (where finish_position = 1)` extend naturally to the additive model.

```sql
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
        when 1 then 25 when 2 then 15 when 3 then 10
        when 4 then 8  when 5 then 6  when 6 then 5
        when 7 then 4  when 8 then 3  when 9 then 2
        when 10 then 1
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
        when 1 then 25 when 2 then 15 when 3 then 10
        when 4 then 8  when 5 then 6  when 6 then 5
        when 7 then 4  when 8 then 3  when 9 then 2
        when 10 then 1
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
  -- gc_scoring and jersey_scoring CTEs unchanged
  ...
```

The rest of the view (gc_scoring, jersey_scoring, final select) is unchanged.

### Tiebreaker semantics

`exact_winners_count` ticks +1 when **either** a primary or a underdog lands P1 on a stage. It cannot tick +2 on the same stage because P1 is held by exactly one rider. Symmetric with the additive score.

## Section 3 — Server action

### Schema and function

Refactor `submitStagePick` into `submitStagePicks` taking both rider IDs:

```ts
const submitStagePicksSchema = z.object({
  stageId: z.string().uuid(),
  primaryRiderId: z.string().uuid(),
  underdogRiderId: z.string().uuid().nullable(),
});

export async function submitStagePicksCore(
  supabase: Supa,
  userId: string,
  input: { stageId: string; primaryRiderId: string; underdogRiderId: string | null },
): Promise<ActionResult<{ stagePickId: string }>> {
  // 1. Stage: exists, not started, not cancelled.
  // 2. Primary rider: exists, in edition, status 'active'.
  // 3. Underdog rider (if non-null): exists, in edition, status 'active', is_top_tier = false.
  // 4. Within-row: primaryRiderId != underdogRiderId.
  // 5. Cross-stage: extend validateNoReuse — pre-flatten existing rows to 1–2 ExistingPick entries
  //    each, then run validator twice (once per target rider).
  // 6. Upsert stage_picks with both columns, onConflict: 'user_id,stage_id'.
  ...
}
```

### Error codes

Reuse existing `rider_already_used_on_stage_<n>`. Add:

- `rider_not_eligible_underdog` — underdog rider has `is_top_tier = true`.
- `primary_equals_underdog` — within-row violation; mirrors the DB check with a friendlier surface.

### `validateNoReuse` adapter

The `ExistingPick` shape and `validateNoReuse` function are unchanged. Only the *adapter* in `submitStagePicksCore` changes: it flattens each `stage_picks` row into 1–2 entries (one for `rider_id`, one for `underdog_rider_id` if set), then calls the validator once per target rider.

A single new test case in `no-reuse.test.ts` covers "underdog already used elsewhere" via the same code path.

### Why one action over two

Atomic upsert keeps the row consistent. A two-action approach (save primary, then save underdog) introduces partial-success failure modes — e.g. primary committed and underdog validation fails, leaving the user mid-state with no clear recovery. One save click → one server roundtrip → one row update.

## Section 4 — UI: `/picks/stage/[n]`

### Layout

```
← Picks

Stage 7
flat · 198 km · Pre-race lock 13:25

CURRENT PICKS
P  [bib]  Pogačar      UAE Team Emirates
H  [bib]  Lutsenko     Astana

[ Primary  ●  ] [  Underdog   ]      ← segmented control

[ search input · diacritic-folded ]

[All · 145]  [Available · 132]      ← chips

──────────────────────────────────
[ rider list — kind-aware filtering ]
──────────────────────────────────

(StickyActionBar above mobile tab bar)
[          Save picks          ]
```

### Tab behavior

Default tab: Primary. Toggling tabs preserves both selections in form state; only Save commits.

| | Primary tab | Underdog tab |
|---|---|---|
| List source | All active riders | Active riders with `is_top_tier = false` |
| `usedOnStageNumber` greying | yes (today's behavior) | yes |
| Within-stage cross-grey | n/a | rider currently *selected* as primary on this stage (saved OR pending in form state) shows `disabledReason: "Already your primary on this stage"` |
| Available filter chip | counts available across full pool | counts available within underdog-eligible pool |

### "Current picks" card

Always shows both saved values when set, regardless of toggle position. Empty rows render dashed placeholders with kind labels.

### Save button

`<StickyActionBar>` (introduced in the jerseys work). Disabled when *neither* tab has unsaved changes.

### Optional "× Remove underdog"

Small inline link inside the Underdog tab when a underdog is currently saved. Sets the form field to null and is committed by the next Save.

### Reused components

`RiderSearchInput`, `filterRidersByQuery`, `RiderPicker`, `StickyActionBar`, `PickerRider.disabledReason`. No new picker primitives.

## Section 5 — Other surfaces

### `/picks` `<StageRow>`

Render two compact rider tiles when underdog is set; current row UI when not.

```
Stage 7 · flat · 198 km
P  [bib] Pogačar   ·  Result P3 (+10)
H  [bib] Lutsenko  ·  —
```

### `/home`

`RecentPicksCard` shows last 3 *scored* picks. With additive scoring, a single stage may contribute two scoring lines; treat each (stage, kind) as its own entry. `HeroNextStage` continues to surface the **primary only** — keep the "your pick for the next stage" focus.

### `/me`

`Stage picks · history` card adds a "Underdog" sub-row when set. Row totals reflect the additive sum; a small kind label clarifies the breakdown.

`Made` BigStat continues to count *stages with at least a primary* — no separate "underdogs made" stat. (YAGNI; can add later.)

### Untouched

Pre-race surfaces, jerseys, GC.

## Section 6 — Admin

Add an `Is top tier` checkbox per rider on the existing riders admin page. Default off.

The underdog feature is **dormant for any edition where no rider is flagged**: the Underdog tab appears but its rider list is identical to Primary's. Documented behavior, not a bug.

Bulk action ("Mark selected rows as top-tier") is reasonable but YAGNI for now — single toggles work fine for ~150 riders.

## Section 7 — Tests

### Vitest, no DB

`validateNoReuse` test extension: one new case for "underdog already used elsewhere" (same code path as primary, but the existing rows now contain underdog-derived ExistingPick entries).

`stage-row.ts` test: trivial — primary-only, primary + underdog both score, primary scores underdog null, both miss.

### Integration tests (Supabase-gated, env `SUPABASE_INTEGRATION=1`)

`src/test/integration/submit-stage-picks.test.ts`:

- saves primary only; underdog omitted
- saves primary + underdog
- updates underdog later without changing primary
- removes underdog (`underdogRiderId: null`)
- rejects: stage locked
- rejects: stage cancelled
- rejects: primary inactive
- rejects: primary wrong edition
- rejects: underdog inactive
- rejects: underdog wrong edition
- rejects: underdog `is_top_tier = true` → `rider_not_eligible_underdog`
- rejects: primary == underdog → `primary_equals_underdog`
- rejects: primary already used on another counted stage
- rejects: underdog already used on another counted stage (cross-pool)
- rejects: underdog equals a rider already used as primary on another stage

`src/test/integration/leaderboard-stage-additive.test.ts` (or extend an existing leaderboard test):

- additive: primary P3 + underdog P7 on the same stage = 10 + 4
- `exact_winners_count` ticks on a underdog P1
- `double_points` doubles both
- cancelled stage produces no score from either column
- underdog null produces only the primary contribution

### E2E (Playwright)

Optional smoke test: `/picks/stage/N` save-primary then add-underdog walkthrough. Mark as nice-to-have, not gating MVP.

## Section 8 — Migrations

```
supabase/migrations/
  20260505000001_riders_is_top_tier.sql       — add boolean column, default false
  20260505000002_stage_picks_hedge.sql        — add underdog_rider_id + check constraint
  20260505000003_leaderboard_view_hedge.sql   — create or replace leaderboard_view with UNION ALL
```

(Bump the date prefix if a later migration lands first; the three files must apply in this order — leaderboard view depends on the column.)

After applying:

```
npm run db:types
```

### Backwards compatibility

Every change is additive. Existing rows continue to score exactly as before:
- `is_top_tier` defaults to `false` → no rider becomes ineligible without admin action.
- `underdog_rider_id` defaults to `NULL` → existing rows score from `rider_id` alone, identical to today.
- The view's underdog stream is filtered by `where sp.underdog_rider_id is not null`, so it contributes zero rows for legacy data.

No data backfill required. No breaking RLS changes — `stage_picks` policies already operate on the row, which still has the same row-level access semantics.

## Out of scope

- Per-stage analytics for underdog picks (popularity, hit rate). Add later if useful.
- A separate "underdogs made" tiebreaker. Symmetric tiebreaker via `exact_winners_count` is enough.
- Bulk admin tooling for `is_top_tier`. Single-row toggles are fine at ~150 riders.
- Changing primary-pick rules or scoring. Untouched.

## Done criteria

1. `is_top_tier` column on riders; admin UI toggles it.
2. `underdog_rider_id` column on stage_picks; check constraint in place.
3. `submitStagePicksCore` validates and upserts both columns atomically; all error codes wired.
4. `validateNoReuse` test case added; existing tests still green.
5. Leaderboard view scores additively across both columns; `exact_winners_count` symmetric.
6. `/picks/stage/[n]` toggle UI saves both picks in one click; dirty-check covers both fields.
7. `/picks`, `/home`, `/me` surfaces show underdog picks where appropriate.
8. Lint, typecheck, vitest green.
