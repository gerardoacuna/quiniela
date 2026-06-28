# GC Top 5 Pre-Race Picks (4th & 5th place) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4th and 5th place to the pre-race GC picks; each awards 25 points (same as the jerseys), exact match only, no partial credit.

**Architecture:** Extend the existing `gc_picks` table and the `final_classifications` GC rows from positions 1–3 to 1–5 (no new tables or enums). GC scoring becomes tiered: positions 1–3 keep 50-exact / 25-in-top3, positions 4–5 are 25-exact-only. The change touches two scoring implementations (TS `gcPoints` and the SQL `leaderboard_view`), the player form, the admin publish flow, and the read-only display surfaces.

**Tech Stack:** Next.js (modified — see `AGENTS.md`), React Server/Client Components, Supabase/Postgres, Zod, Vitest. Inline-style design system (`var(--...)` tokens).

## Global Constraints

- This is a modified Next.js — read `node_modules/next/dist/docs/` before writing framework code; do not assume stock APIs.
- Jersey points are currently **25** (live SQL view `20260505000011`), not 50. 4th/5th place must award **25**, exact match only, **no partial credit**.
- Top-3 partial credit ("right rider, finished in actual top 3 at a different position") stays scoped to positions **1–3 only**. It must NOT widen to top-5 when the data grows to 5 finishers.
- GC section max after this change: 50×3 + 25×2 = **200 points**.
- Never edit historical migration files. Add a new forward migration.
- Seeded riders (for tests): POG `…001`, AYU `…002`, EVE `…003`, ROG `…004`, GAN `…005` (full prefix `20000000-0000-4000-8000-0000000000NN`). EDITION `00000000-0000-4000-8000-000000000001`.
- Integration tests are gated behind `SUPABASE_INTEGRATION=1` and skipped otherwise.
- Follow existing file conventions (inline styles, `ActionResult` return shape, `*Core` testable action functions).

---

### Task 1: Tiered GC scoring (pure TS)

**Files:**
- Modify: `src/lib/scoring/gc.ts`
- Test: `src/lib/scoring/gc.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `gcPoints(picks: readonly GcPick[], actual: readonly GcActual[]): number` — unchanged signature; `GcPick`/`GcActual` keep `{ position: number; rider_id: string }`. New behavior: exact match awards 50 for positions 1–3 and 25 for positions 4–5; in-top-3 wrong-slot awards 25 only for picks at positions 1–3; partial-credit "podium" set is built from actual rows with position ≤ 3 only.

- [ ] **Step 1: Add failing tests for 4th/5th and podium-scoping**

Append these cases inside the existing `describe('gcPoints', …)` block in `src/lib/scoring/gc.test.ts`. Note the new `actual5` fixture that includes 4th and 5th finishers:

```ts
  const actual5 = [
    { position: 1, rider_id: 'pogacar' },
    { position: 2, rider_id: 'ayuso' },
    { position: 3, rider_id: 'evenepoel' },
    { position: 4, rider_id: 'roglic' },
    { position: 5, rider_id: 'ganna' },
  ];

  it('awards 25 for an exact 4th-place pick', () => {
    const picks = [{ position: 4, rider_id: 'roglic' }];
    expect(gcPoints(picks, actual5)).toBe(25);
  });

  it('awards 25 for an exact 5th-place pick', () => {
    const picks = [{ position: 5, rider_id: 'ganna' }];
    expect(gcPoints(picks, actual5)).toBe(25);
  });

  it('gives 0 for a 4th-place pick whose rider finished 5th (no partial credit on 4/5)', () => {
    const picks = [{ position: 4, rider_id: 'ganna' }];
    expect(gcPoints(picks, actual5)).toBe(0);
  });

  it('gives 0 when a top-3 pick finishes 4th or 5th (podium stays top-3)', () => {
    const picks = [{ position: 1, rider_id: 'roglic' }]; // roglic finished 4th
    expect(gcPoints(picks, actual5)).toBe(0);
  });

  it('top-3 partial credit is unchanged when 4th/5th finishers exist', () => {
    const picks = [
      { position: 1, rider_id: 'evenepoel' }, // in top 3, wrong slot → 25
      { position: 2, rider_id: 'pogacar' },   // in top 3, wrong slot → 25
      { position: 3, rider_id: 'ayuso' },     // in top 3, wrong slot → 25
    ];
    expect(gcPoints(picks, actual5)).toBe(75);
  });

  it('scores a full top-5 slate', () => {
    const picks = [
      { position: 1, rider_id: 'pogacar' },   // 50
      { position: 2, rider_id: 'ayuso' },     // 50
      { position: 3, rider_id: 'evenepoel' }, // 50
      { position: 4, rider_id: 'roglic' },    // 25
      { position: 5, rider_id: 'ganna' },     // 25
    ];
    expect(gcPoints(picks, actual5)).toBe(200);
  });
```

- [ ] **Step 2: Run the tests and confirm the new ones fail**

Run: `npx vitest run src/lib/scoring/gc.test.ts`
Expected: the 4 new 4th/5th cases fail (e.g. exact-4th returns 0 because current code only awards 50/25 via the all-positions podium set; the "top-3 pick finishes 4th" case may currently return 25 because the podium set wrongly includes 4th/5th). Pre-existing cases still pass.

- [ ] **Step 3: Rewrite `gcPoints` with tiered, podium-scoped logic**

Replace the body of `src/lib/scoring/gc.ts` (keep the two interfaces above it unchanged):

```ts
export function gcPoints(picks: readonly GcPick[], actual: readonly GcActual[]): number {
  if (actual.length === 0) return 0;
  // Partial credit ("right rider, wrong slot") is scoped to the actual top 3.
  const podium = new Set(
    actual.filter((a) => a.position >= 1 && a.position <= 3).map((a) => a.rider_id),
  );
  const exactByPos = new Map(actual.map((a) => [a.position, a.rider_id] as const));

  let total = 0;
  for (const pick of picks) {
    const exactRider = exactByPos.get(pick.position);
    if (exactRider && exactRider === pick.rider_id) {
      total += pick.position <= 3 ? 50 : 25;
    } else if (pick.position <= 3 && podium.has(pick.rider_id)) {
      total += 25;
    }
  }
  return total;
}
```

- [ ] **Step 4: Run the tests and confirm all pass**

Run: `npx vitest run src/lib/scoring/gc.test.ts`
Expected: PASS (all old + new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/gc.ts src/lib/scoring/gc.test.ts
git commit -m "feat(scoring): tiered GC points for 4th/5th place (25 exact, podium stays top-3)"
```

---

### Task 2: Fix stale jersey points constant (50 → 25)

**Files:**
- Modify: `src/lib/scoring/jersey.ts`
- Test: `src/lib/scoring/jersey.test.ts`

**Interfaces:**
- Produces: `JERSEY_POINTS = 25` and `jerseyPoints(pick, actualWinnerRiderId)` returning 25 on match. (Only consumer is its own test; this aligns the dead TS module with the live SQL view.)

- [ ] **Step 1: Update the test expectations to 25**

In `src/lib/scoring/jersey.test.ts`, change the three `50` expectations to `25`:

```ts
    expect(JERSEY_POINTS).toBe(25);
```
```ts
    expect(jerseyPoints({ rider_id: 'pogacar' }, 'pogacar')).toBe(25);
```
(Leave the `0` cases unchanged.)

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/scoring/jersey.test.ts`
Expected: FAIL — `JERSEY_POINTS` is still 50.

- [ ] **Step 3: Change the constant**

In `src/lib/scoring/jersey.ts`:

```ts
export const JERSEY_POINTS = 25;
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/scoring/jersey.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/jersey.ts src/lib/scoring/jersey.test.ts
git commit -m "fix(scoring): align JERSEY_POINTS constant with live 25-pt SQL view"
```

---

### Task 3: Migration — widen constraints and redefine leaderboard view

**Files:**
- Create: `supabase/migrations/20260628000001_gc_top5_picks.sql`

**Interfaces:**
- Produces: `gc_picks.position` allowed 1–5; `final_classifications` GC rows allowed positions 1–5; `leaderboard_view.gc_points` computes 50 for exact 1–3, 25 for exact 4–5, 25 for in-top-3 wrong-slot (positions 1–3 only). `jersey_points` unchanged at 25.

**Background:** The current `final_classifications` check is named `final_classifications_position_check` (from `20260427000002`). The current leaderboard view is defined in `20260505000011`. This migration copies that view verbatim except for the `gc_scoring` CTE.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260628000001_gc_top5_picks.sql` with exactly:

```sql
-- 4th & 5th place GC picks.
-- 1. Allow gc_picks positions 1..5 and final_classifications GC positions 1..5.
-- 2. Redefine leaderboard_view so GC scoring is tiered:
--      exact 1..3 -> 50, exact 4..5 -> 25, in-top-3 wrong-slot (1..3 only) -> 25.
--    Partial credit must NOT widen to top-5 even though 5 GC finishers now exist.

alter table public.gc_picks
  drop constraint if exists gc_picks_position_check;
alter table public.gc_picks
  add constraint gc_picks_position_check check (position between 1 and 5);

alter table public.final_classifications
  drop constraint if exists final_classifications_position_check;
alter table public.final_classifications
  add constraint final_classifications_position_check check (
    (kind = 'gc'            and position between 1 and 5) or
    (kind = 'points_jersey' and position = 1) or
    (kind = 'white_jersey'  and position = 1)
  );

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
          when gp.rider_id = fc_exact.rider_id and gp.position between 1 and 3 then 50
          when gp.rider_id = fc_exact.rider_id and gp.position between 4 and 5 then 25
          when gp.position between 1 and 3 and gp.rider_id in (
            select rider_id from public.final_classifications fc2
            where fc2.edition_id = gp.edition_id
              and fc2.kind = 'gc'
              and fc2.status = 'published'
              and fc2.position between 1 and 3
          ) then 25
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

- [ ] **Step 2: Apply the migration to the local DB**

Run: `npx supabase db reset` (re-applies all migrations + seed)
Expected: completes without error; the new migration runs last.

- [ ] **Step 3: Verify constraints and view exist**

Run: `npx supabase db reset >/dev/null 2>&1 && echo "reset ok"` then, in a psql session against the local DB (`psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')"`), run:
`\d public.gc_picks` and `\d public.final_classifications`
Expected: `gc_picks_position_check` shows `position BETWEEN 1 AND 5`; `final_classifications_position_check` allows `gc … BETWEEN 1 AND 5` plus both jerseys at position 1.
(If `npx supabase status` is unavailable in this environment, skip the psql check — Task 5's integration test exercises the constraints and view end-to-end.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628000001_gc_top5_picks.sql
git commit -m "feat(db): allow GC picks/finals positions 1-5; tier GC scoring in leaderboard view"
```

---

### Task 4: GC pick server action — accept 5 positions

**Files:**
- Modify: `src/lib/actions/picks.ts` (`submitGcPicksSchema`, `submitGcPicksCore`, `submitGcPicks` — lines ~145–209)
- Test: `src/test/integration/submit-gc-jersey.test.ts`

**Interfaces:**
- Consumes: `gc_picks` table widened to positions 1–5 (Task 3).
- Produces: `submitGcPicksCore(supabase, userId, input)` where `input = { editionId, first, second, third, fourth, fifth }` (all uuid strings). Validates 5 distinct active riders in the edition; upserts positions 1–5. Error codes unchanged (`gc_riders_must_be_distinct`, `rider_not_found`, `rider_wrong_edition`, `rider_not_active`, `gc_locked`, `edition_missing_stage_1`). `submitGcPicks(prev, formData)` reads form fields `first|second|third|fourth|fifth`.

- [ ] **Step 1: Extend the integration test**

In `src/test/integration/submit-gc-jersey.test.ts`, add the two extra rider constants and replace the "saves 3 distinct picks" test, then add a 5-distinct test. Full edited rider-constant block + tests:

```ts
const RIDER_POG = '20000000-0000-4000-8000-000000000001';
const RIDER_AYU = '20000000-0000-4000-8000-000000000002';
const RIDER_EVE = '20000000-0000-4000-8000-000000000003';
const RIDER_ROG = '20000000-0000-4000-8000-000000000004';
const RIDER_GAN = '20000000-0000-4000-8000-000000000005';
```

Replace the existing `it('saves 3 distinct picks', …)` with:

```ts
  it('saves 5 distinct picks', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitGcPicksCore(c, user.userId, {
      editionId: EDITION,
      first: RIDER_POG,
      second: RIDER_AYU,
      third: RIDER_EVE,
      fourth: RIDER_ROG,
      fifth: RIDER_GAN,
    });
    expect(res.ok).toBe(true);
  });
```

Update the duplicate test to pass all 5 fields (duplicate POG in first+second):

```ts
  it('rejects duplicate rider across slots', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitGcPicksCore(c, user.userId, {
      editionId: EDITION,
      first: RIDER_POG,
      second: RIDER_POG,
      third: RIDER_EVE,
      fourth: RIDER_ROG,
      fifth: RIDER_GAN,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('gc_riders_must_be_distinct');
  });
```

- [ ] **Step 2: Run the integration test and confirm it fails to typecheck/fail**

Run: `SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/submit-gc-jersey.test.ts`
Expected: FAIL — `submitGcPicksCore` does not accept `fourth`/`fifth` (type error) or saves only 3.
(If no integration DB is available, run `npx tsc --noEmit` and expect the type error on `fourth`/`fifth`.)

- [ ] **Step 3: Update the schema**

In `src/lib/actions/picks.ts`, replace `submitGcPicksSchema`:

```ts
const submitGcPicksSchema = z.object({
  editionId: z.string().uuid(),
  first: z.string().uuid(),
  second: z.string().uuid(),
  third: z.string().uuid(),
  fourth: z.string().uuid(),
  fifth: z.string().uuid(),
});
```

- [ ] **Step 4: Update `submitGcPicksCore`**

Replace the body of `submitGcPicksCore` with the 5-slot version:

```ts
export async function submitGcPicksCore(
  supabase: Supa,
  userId: string,
  input: { editionId: string; first: string; second: string; third: string; fourth: string; fifth: string },
): Promise<ActionResult> {
  const slots = [input.first, input.second, input.third, input.fourth, input.fifth];
  if (new Set(slots).size !== 5) return { ok: false, error: 'gc_riders_must_be_distinct' };

  const { data: stage1, error: s1Err } = await supabase
    .from('stages')
    .select('start_time')
    .eq('edition_id', input.editionId)
    .eq('number', 1)
    .maybeSingle();
  if (s1Err) return { ok: false, error: s1Err.message };
  if (!stage1) return { ok: false, error: 'edition_missing_stage_1' };
  if (new Date(stage1.start_time).getTime() <= Date.now()) return { ok: false, error: 'gc_locked' };

  const { data: riders, error: rErr } = await supabase
    .from('riders')
    .select('id, edition_id, status')
    .in('id', slots);
  if (rErr) return { ok: false, error: rErr.message };
  if (!riders || riders.length !== 5) return { ok: false, error: 'rider_not_found' };
  for (const r of riders) {
    if (r.edition_id !== input.editionId) return { ok: false, error: 'rider_wrong_edition' };
    if (r.status !== 'active') return { ok: false, error: 'rider_not_active' };
  }

  const rows = slots.map((rider_id, i) => ({
    user_id: userId,
    edition_id: input.editionId,
    position: i + 1,
    rider_id,
  }));
  const { error } = await supabase
    .from('gc_picks')
    .upsert(rows, { onConflict: 'user_id,edition_id,position' });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}
```

- [ ] **Step 5: Update the `submitGcPicks` form reader**

Replace the `safeParse` call inside `submitGcPicks`:

```ts
  const parsed = submitGcPicksSchema.safeParse({
    editionId: formData.get('editionId'),
    first: formData.get('first'),
    second: formData.get('second'),
    third: formData.get('third'),
    fourth: formData.get('fourth'),
    fifth: formData.get('fifth'),
  });
```

- [ ] **Step 6: Run the integration test (or typecheck) and confirm pass**

Run: `SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/submit-gc-jersey.test.ts`
Expected: PASS. (No integration DB: `npx tsc --noEmit` is clean for this file.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/picks.ts src/test/integration/submit-gc-jersey.test.ts
git commit -m "feat(picks): submit GC top 5 (5 distinct riders, positions 1-5)"
```

---

### Task 5: Admin publish — 4th & 5th GC finishers

**Files:**
- Modify: `src/lib/actions/admin-final.ts` (`publishFinalSchema`, `publishFinalCore`)
- Modify: `src/app/admin/classifications/page.tsx` (initial GC loader)
- Modify: `src/app/admin/classifications/form.tsx` (`FinalForm` props + 5 selects + validity)
- Test: `src/test/integration/admin-publish-final.test.ts`

**Interfaces:**
- Consumes: widened `final_classifications` constraint + tiered view (Task 3).
- Produces: `publishFinalCore` accepts `gc?: { first, second, third, fourth, fifth }` (all uuid); validates 5 distinct; deletes+inserts 5 GC rows at positions 1–5. `FinalForm` takes `initialGc: { first, second, third, fourth, fifth }`.

- [ ] **Step 1: Extend the integration test**

In `src/test/integration/admin-publish-final.test.ts`, add `R_GAN` and update GC setup + the GC scoring test. Add constant:

```ts
const R_GAN = '20000000-0000-4000-8000-000000000005';
```

In `beforeAll`, replace the player GC insert block so the player has a full top-5 slate that exactly matches what we publish (50×3 + 25×2 = 200):

```ts
    await a.from('gc_picks').delete().eq('user_id', player.userId);
    await a.from('gc_picks').insert([
      { user_id: player.userId, edition_id: EDITION, position: 1, rider_id: R_POG },
      { user_id: player.userId, edition_id: EDITION, position: 2, rider_id: R_AYU },
      { user_id: player.userId, edition_id: EDITION, position: 3, rider_id: R_EVE },
      { user_id: player.userId, edition_id: EDITION, position: 4, rider_id: R_ROG },
      { user_id: player.userId, edition_id: EDITION, position: 5, rider_id: R_GAN },
    ]);
```

Replace the `'publishing GC matching player picks awards 150 pts'` test with:

```ts
  it('publishing GC top 5 matching player picks awards 200 pts', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishFinalCore(c, admin.userId, {
      editionId: EDITION,
      gc: { first: R_POG, second: R_AYU, third: R_EVE, fourth: R_ROG, fifth: R_GAN },
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a.from('leaderboard_view').select('*').eq('user_id', player.userId);
    expect(data?.[0]?.gc_points).toBe(200);
  });

  it('a correct 4th-place pick alone awards 25 pts', async () => {
    const a = createAdminClient();
    await a.from('gc_picks').delete().eq('user_id', player.userId);
    await a.from('gc_picks').insert([
      { user_id: player.userId, edition_id: EDITION, position: 4, rider_id: R_ROG },
    ]);
    await a.from('final_classifications').delete().eq('edition_id', EDITION);

    const c = await userClient(admin.email, admin.password);
    const res = await publishFinalCore(c, admin.userId, {
      editionId: EDITION,
      gc: { first: R_POG, second: R_AYU, third: R_EVE, fourth: R_ROG, fifth: R_GAN },
    });
    expect(res.ok).toBe(true);

    const { data } = await a.from('leaderboard_view').select('*').eq('user_id', player.userId);
    expect(data?.[0]?.gc_points).toBe(25);
  });
```

Update the `'rejects duplicate riders in GC'` test to pass 5 fields:

```ts
  it('rejects duplicate riders in GC', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishFinalCore(c, admin.userId, {
      editionId: EDITION,
      gc: { first: R_POG, second: R_POG, third: R_EVE, fourth: R_ROG, fifth: R_GAN },
    });
    expect(res.ok).toBe(false);
  });
```

- [ ] **Step 2: Run and confirm failure**

Run: `SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/admin-publish-final.test.ts`
Expected: FAIL — `publishFinalCore` GC type lacks `fourth`/`fifth`; gc_points ≠ 200. (No DB: `npx tsc --noEmit` shows the GC type error.)

- [ ] **Step 3: Update schema + core in `admin-final.ts`**

Replace the `gc` object in `publishFinalSchema`:

```ts
  gc: z.object({
    first: z.string().uuid(),
    second: z.string().uuid(),
    third: z.string().uuid(),
    fourth: z.string().uuid(),
    fifth: z.string().uuid(),
  }).optional(),
```

Replace the `if (input.gc) { … }` block inside `publishFinalCore`:

```ts
  if (input.gc) {
    const ids = [input.gc.first, input.gc.second, input.gc.third, input.gc.fourth, input.gc.fifth];
    if (new Set(ids).size !== 5) return { ok: false, error: 'gc_riders_must_be_distinct' };

    await supabase.from('final_classifications').delete()
      .eq('edition_id', input.editionId).eq('kind', 'gc');
    const { error } = await supabase.from('final_classifications').insert(
      ids.map((rider_id, i) => ({
        edition_id: input.editionId, kind: 'gc' as const, position: i + 1, rider_id, status: 'published' as const,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }
```

- [ ] **Step 4: Update the admin loader `page.tsx`**

In `src/app/admin/classifications/page.tsx`, extend `initialGc`:

```tsx
      initialGc={{
        first:  gcByPos.get(1) ?? '',
        second: gcByPos.get(2) ?? '',
        third:  gcByPos.get(3) ?? '',
        fourth: gcByPos.get(4) ?? '',
        fifth:  gcByPos.get(5) ?? '',
      }}
```

- [ ] **Step 5: Update `FinalForm` in `form.tsx`**

Change the `initialGc` prop type and the GC section. Replace the prop type line:

```tsx
  initialGc: { first: string; second: string; third: string; fourth: string; fifth: string };
```

Replace `gcValid`:

```tsx
  const gcSlots = [gc.first, gc.second, gc.third, gc.fourth, gc.fifth];
  const gcValid = gcSlots.every(Boolean) && new Set(gcSlots).size === 5;
```

Replace the GC `<section>` body (the three labels + validity message) with five labels:

```tsx
      <section className="space-y-2">
        <h2 className="font-semibold">GC top 5</h2>
        <label className="block text-sm">1st place
          <RiderSelect id="first" value={gc.first} onChange={(v) => setGc({ ...gc, first: v })} riders={riders} />
        </label>
        <label className="block text-sm">2nd place
          <RiderSelect id="second" value={gc.second} onChange={(v) => setGc({ ...gc, second: v })} riders={riders} />
        </label>
        <label className="block text-sm">3rd place
          <RiderSelect id="third" value={gc.third} onChange={(v) => setGc({ ...gc, third: v })} riders={riders} />
        </label>
        <label className="block text-sm">4th place
          <RiderSelect id="fourth" value={gc.fourth} onChange={(v) => setGc({ ...gc, fourth: v })} riders={riders} />
        </label>
        <label className="block text-sm">5th place
          <RiderSelect id="fifth" value={gc.fifth} onChange={(v) => setGc({ ...gc, fifth: v })} riders={riders} />
        </label>
        {!gcValid && gcSlots.some(Boolean) && (
          <p className="text-xs text-red-600">All five slots need distinct riders to publish GC.</p>
        )}
      </section>
```

Also update the intro `<p>` copy "Set and publish GC top-3, …" → "GC top-5, …".

- [ ] **Step 6: Run the integration test (or typecheck) and confirm pass**

Run: `SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/admin-publish-final.test.ts`
Expected: PASS (200 and 25 assertions hold). No DB: `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/admin-final.ts src/app/admin/classifications/page.tsx src/app/admin/classifications/form.tsx src/test/integration/admin-publish-final.test.ts
git commit -m "feat(admin): publish GC top 5 finishers (4th & 5th)"
```

---

### Task 6: Player GC pick form — 5 slots

**Files:**
- Modify: `src/app/(app)/picks/gc/form.tsx`

**Interfaces:**
- Consumes: `submitGcPicks` form fields `first|second|third|fourth|fifth` (Task 4). `page.tsx` already passes `initialPicks` for all positions (it maps every row, no 1–3 cap on the query) — but `form.tsx` currently drops positions > 3. This task widens the form to 5.

**Note:** `page.tsx` builds `initialPicks` by mapping each `gc_picks` row with `position` ≤ existing range; its query orders by position with no limit, so positions 4–5 arrive once saved. No `page.tsx` change needed beyond what already maps `{ position, rider }`.

- [ ] **Step 1: Widen state and labels**

In `src/app/(app)/picks/gc/form.tsx`, replace the slot-label constants and the `initPickIds` / state types. Replace lines defining `SLOT_LABELS`, `SLOT_ORDINALS`:

```tsx
const SLOT_LABELS = ['1st', '2nd', '3rd', '4th', '5th'] as const;
const SLOT_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
type Slot5 = [string | null, string | null, string | null, string | null, string | null];
```

Replace the `initPickIds` block and the `picks`/`editingPos` state:

```tsx
  // picks[0] = 1st … picks[4] = 5th
  const initPickIds: Slot5 = [null, null, null, null, null];
  for (const p of initialPicks) {
    if (p.position >= 1 && p.position <= 5) {
      initPickIds[p.position - 1] = p.rider.id;
    }
  }

  const [picks, setPicks] = useState<Slot5>(initPickIds);
  const [editingPos, setEditingPos] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
```

- [ ] **Step 2: Widen validity + handlers**

Replace the `allFilled` / `allDistinct` / `unchanged` block:

```tsx
  const allFilled = picks.every((p) => p !== null);
  const allDistinct = allFilled && new Set(picks).size === 5;
  const unchanged = picks.every((p, i) => p === savedPicks[i]);
  const saveDisabled = isLocked || !allDistinct || unchanged || pending;
```

Replace `handleSlotClick` and `handlePickerSelect` signatures/bodies to use `Slot5`:

```tsx
  function handleSlotClick(pos: 1 | 2 | 3 | 4 | 5) {
    if (isLocked) return;
    setEditingPos((prev) => (prev === pos ? null : pos));
    setQuery('');
  }

  function handlePickerSelect(riderId: string) {
    if (editingPos === null) return;
    const idx = editingPos - 1;
    setPicks((prev) => {
      const next = [...prev] as Slot5;
      next[idx] = riderId;
      return next;
    });
    setEditingPos(null);
  }
```

- [ ] **Step 3: Render 5 slot tiles**

Replace the slot-tiles grid header line and the `([1, 2, 3] as const).map(...)`:

```tsx
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {([1, 2, 3, 4, 5] as const).map((pos) => {
```

(The tile body is unchanged — it already reads `SLOT_LABELS[idx]` and `picks[idx]`.)

- [ ] **Step 4: Update title, scoring copy, and hidden inputs**

Replace the `PageHeading`:

```tsx
      <PageHeading
        eyebrow="Pre-race"
        title="GC Top 5"
        sub="1st–3rd: 50 pts exact · 25 pts wrong-slot podium. 4th–5th: 25 pts exact only."
      />
```

Replace the scoring explainer block contents:

```tsx
        <strong style={{ color: 'var(--ink)', fontSize: 13 }}>Scoring max 200 pts.</strong>
        <br />
        · 1st–3rd: 50 pts at the exact position, 25 pts if your pick lands in the actual top 3 at a different slot
        <br />
        · 4th &amp; 5th: 25 pts only if your pick finishes at that exact position
        <br />
        · 0 pts otherwise
```

Replace the three hidden inputs with five:

```tsx
          <input type="hidden" name={SLOT_ORDINALS[0]} value={picks[0] ?? ''} />
          <input type="hidden" name={SLOT_ORDINALS[1]} value={picks[1] ?? ''} />
          <input type="hidden" name={SLOT_ORDINALS[2]} value={picks[2] ?? ''} />
          <input type="hidden" name={SLOT_ORDINALS[3]} value={picks[3] ?? ''} />
          <input type="hidden" name={SLOT_ORDINALS[4]} value={picks[4] ?? ''} />
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint --file src/app/\(app\)/picks/gc/form.tsx` (or the project's lint script)
Expected: no type errors; the `[...prev] as Slot5` and `picks.every` typecheck. The `pickerRiders` memo's `picks.every((p, i) => …)` already works for 5 entries.

- [ ] **Step 6: Manual smoke (optional but recommended)**

Run the app (see `/run`), open `/picks/gc`, confirm five tiles, pick 5 distinct riders, save, reload — all five persist.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/picks/gc/form.tsx"
git commit -m "feat(picks): GC pick form supports 5 slots (4th & 5th)"
```

---

### Task 7: Board GC data layer — p4/p5

**Files:**
- Modify: `src/lib/queries/board-gc.ts`
- Test: `src/lib/queries/board-gc.test.ts`

**Interfaces:**
- Produces: `GcRawRow.position: 1|2|3|4|5`; `BoardGcByPlayerRow.picks` gains `p4`/`p5`; `BoardGcByRiderRow` gains `p4Names`/`p5Names`. `buildGcByPlayer` fills all 5 slots; `buildGcByRider` aggregates all 5 and counts all 5 for ordering.

- [ ] **Step 1: Extend the pure-transform tests**

In `src/lib/queries/board-gc.test.ts`, widen the `pick` factory position type and add a 4th/5th case. Replace the factory signature:

```ts
function pick(userId: string, displayName: string, position: 1 | 2 | 3 | 4 | 5, rider: typeof POG): GcRawRow {
```

Add inside `describe('buildGcByPlayer', …)`:

```ts
  it('fills 4th and 5th slots', () => {
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 1, POG),
      pick(ALICE, 'Alice', 4, VIN),
      pick(ALICE, 'Alice', 5, ROG),
    ];
    const out = buildGcByPlayer(rows, [ALICE]);
    expect(out[0].picks.p4?.id).toBe('r-vin');
    expect(out[0].picks.p5?.id).toBe('r-rog');
    expect(out[0].picks.p2).toBeNull();
  });
```

Add inside `describe('buildGcByRider', …)` (or wherever its block is):

```ts
  it('aggregates 4th/5th pickers', () => {
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 4, POG),
      pick(BOB,   'Bob',   5, POG),
    ];
    const out = buildGcByRider(rows, ALICE);
    const pog = out.find((r) => r.rider.id === 'r-pog')!;
    expect(pog.p4Names).toEqual(['You']);
    expect(pog.p5Names).toEqual(['Bob']);
  });
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/queries/board-gc.test.ts`
Expected: FAIL — `p4`/`p5` and `p4Names`/`p5Names` don't exist.

- [ ] **Step 3: Update types in `board-gc.ts`**

Replace `GcRawRow.position`, `BoardGcByPlayerRow.picks`, and `BoardGcByRiderRow`:

```ts
export interface GcRawRow {
  user_id: string;
  position: 1 | 2 | 3 | 4 | 5;
  profiles: { display_name: string };
  riders: GcRider;
}

export interface BoardGcByPlayerRow {
  userId: string;
  displayName: string;
  picks: {
    p1: GcRider | null;
    p2: GcRider | null;
    p3: GcRider | null;
    p4: GcRider | null;
    p5: GcRider | null;
  };
}

export interface BoardGcByRiderRow {
  rider: GcRider;
  p1Names: string[];
  p2Names: string[];
  p3Names: string[];
  p4Names: string[];
  p5Names: string[];
}
```

- [ ] **Step 4: Update `buildGcByPlayer`**

Replace the empty-picks initializer and the position assignment:

```ts
      entry = {
        userId: r.user_id,
        displayName: r.profiles.display_name,
        picks: { p1: null, p2: null, p3: null, p4: null, p5: null },
      };
      byUser.set(r.user_id, entry);
    }
    if (r.position === 1) entry.picks.p1 = r.riders;
    else if (r.position === 2) entry.picks.p2 = r.riders;
    else if (r.position === 3) entry.picks.p3 = r.riders;
    else if (r.position === 4) entry.picks.p4 = r.riders;
    else if (r.position === 5) entry.picks.p5 = r.riders;
```

And the fallback default in the `.map`:

```ts
      byUser.get(userId) ?? {
        userId,
        displayName: '',
        picks: { p1: null, p2: null, p3: null, p4: null, p5: null },
      },
```

- [ ] **Step 5: Update `buildGcByRider`**

Replace the byRider map value type, the per-row slot push, the return mapping, and the sort total. Map value type:

```ts
  const byRider = new Map<
    string,
    {
      rider: GcRider;
      p1: Array<{ userId: string; displayName: string }>;
      p2: Array<{ userId: string; displayName: string }>;
      p3: Array<{ userId: string; displayName: string }>;
      p4: Array<{ userId: string; displayName: string }>;
      p5: Array<{ userId: string; displayName: string }>;
    }
  >();
```

Init + push:

```ts
    if (!entry) {
      entry = { rider: r.riders, p1: [], p2: [], p3: [], p4: [], p5: [] };
      byRider.set(r.riders.id, entry);
    }
    const slot =
      r.position === 1 ? entry.p1
      : r.position === 2 ? entry.p2
      : r.position === 3 ? entry.p3
      : r.position === 4 ? entry.p4
      : entry.p5;
    slot.push({ userId: r.user_id, displayName: r.profiles.display_name });
```

Return map + sort:

```ts
  return Array.from(byRider.values())
    .map((e) => ({
      rider: e.rider,
      p1Names: formatNames(e.p1),
      p2Names: formatNames(e.p2),
      p3Names: formatNames(e.p3),
      p4Names: formatNames(e.p4),
      p5Names: formatNames(e.p5),
    }))
    .sort((a, b) => {
      const totalA = a.p1Names.length + a.p2Names.length + a.p3Names.length + a.p4Names.length + a.p5Names.length;
      const totalB = b.p1Names.length + b.p2Names.length + b.p3Names.length + b.p4Names.length + b.p5Names.length;
      if (totalA !== totalB) return totalB - totalA;
      return a.rider.name.localeCompare(b.rider.name);
    });
```

(The `getBoardGcData` query already selects `position` with no limit — no change needed.)

- [ ] **Step 6: Run tests + typecheck, confirm pass**

Run: `npx vitest run src/lib/queries/board-gc.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/queries/board-gc.ts src/lib/queries/board-gc.test.ts
git commit -m "feat(board): GC board data layer carries 4th & 5th place"
```

---

### Task 8: Board GC display — show 5 slots

**Files:**
- Modify: `src/app/(app)/board/everyones-gc.tsx`

**Interfaces:**
- Consumes: `BoardGcByPlayerRow.picks.{p1..p5}` and `BoardGcByRiderRow.{p1..p5}Names` (Task 7).

**Design decision (flag for review):** The by-player grid would become 6 columns (Player + 1st–5th). On a ~360px phone that's too tight to also show rider names, so the per-slot cell shows the **BibTile only** (no name) in this grid. Full names remain visible in the "Who picked whom" consensus card below, which is a vertical list and handles 5 slots comfortably.

- [ ] **Step 1: Widen the player grid to 6 columns (bib-only cells)**

In `PlayerGroupedCard`, change both `gridTemplateColumns: '1fr 1fr 1fr 1fr'` occurrences (header + row) to:

```tsx
          gridTemplateColumns: '1.4fr repeat(5, 1fr)',
```

Replace the header spans:

```tsx
        <span>Player</span>
        <span>1st</span>
        <span>2nd</span>
        <span>3rd</span>
        <span>4th</span>
        <span>5th</span>
```

Replace the `empty` span `gridColumn: 'span 3'` with `'span 5'`, and replace the filled `<RiderSlot ... />` block:

```tsx
            ) : (
              <>
                <RiderSlot rider={r.picks.p1} />
                <RiderSlot rider={r.picks.p2} />
                <RiderSlot rider={r.picks.p3} />
                <RiderSlot rider={r.picks.p4} />
                <RiderSlot rider={r.picks.p5} />
              </>
            )}
```

Replace `RiderSlot` to render bib only (fits 6 columns):

```tsx
function RiderSlot({
  rider,
}: {
  rider: BoardGcByPlayerRow['picks']['p1'];
}) {
  if (!rider) return <span style={{ color: 'var(--ink-mute)' }}>—</span>;
  return <BibTile num={rider.bib} size={20} />;
}
```

- [ ] **Step 2: Add 4th/5th to the consensus card**

In `RiderGroupedCard`, update the pick-count total and the slot list. Replace the count line:

```tsx
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {r.p1Names.length + r.p2Names.length + r.p3Names.length + r.p4Names.length + r.p5Names.length} pick
                {r.p1Names.length + r.p2Names.length + r.p3Names.length + r.p4Names.length + r.p5Names.length === 1
                  ? ''
                  : 's'}
              </div>
```

Replace the `(['p1', 'p2', 'p3'] as const).map(...)` slot loop header and its `names`/`label` derivation:

```tsx
              {(['p1', 'p2', 'p3', 'p4', 'p5'] as const).map((slot) => {
                const names =
                  slot === 'p1' ? r.p1Names
                  : slot === 'p2' ? r.p2Names
                  : slot === 'p3' ? r.p3Names
                  : slot === 'p4' ? r.p4Names
                  : r.p5Names;
                if (names.length === 0) return null;
                const label =
                  slot === 'p1' ? '1st'
                  : slot === 'p2' ? '2nd'
                  : slot === 'p3' ? '3rd'
                  : slot === 'p4' ? '4th'
                  : '5th';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/board/everyones-gc.tsx"
git commit -m "feat(board): display 4th & 5th place in everyone's GC view"
```

---

### Task 9: Read-only player displays (home card, picks strip, me page)

**Files:**
- Modify: `src/app/(app)/picks/pre-race-strip.tsx`
- Modify: `src/app/(app)/home/pre-race-card.tsx`
- Modify: `src/app/(app)/me/page.tsx`

**Interfaces:**
- Consumes: `gcPicks` arrays that may now contain 5 rows ordered by position. All three already iterate or slice GC picks; this task lifts the 3-cap and relabels.

- [ ] **Step 1: `pre-race-strip.tsx` — show up to 5**

Change the GC mini-card label and the slice. Replace `label="GC Top 3"` with `label="GC Top 5"`, and replace `gcPicks.slice(0, 3)` with `gcPicks.slice(0, 5)`. The inner P-number badge already uses `P{i + 1}`, which now renders P1–P5. (The 26px BibTiles in a flex row fit 5 within the third-of-width card; if visually cramped, reduce `BibTile size={26}` to `20` — verify in the smoke check.)

- [ ] **Step 2: `pre-race-card.tsx` — relabel only**

The GC column uses `gcPicks.map((p) => …)` with no cap, so 4th/5th already render. Only relabel: change `GC Top 3` text to `GC Top 5`.

- [ ] **Step 3: `me/page.tsx` — relabel + widen the placeholder grid**

The filled branch uses `gcPicks.map((g) => …)` (no cap) — 4th/5th already render. Two edits:
- Change the `GC Top 3` heading text to `GC Top 5`.
- The grid uses `gridTemplateColumns: '1fr 1fr 1fr'` and the empty-state renders `[0, 1, 2].map(...)`. Change the grid to `'repeat(5, 1fr)'` and the placeholder to `[0, 1, 2, 3, 4].map(...)` so an unset slate shows five P-tiles consistent with the filled state.

Replace the grid style line:

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 8 }}>
```

Replace the empty-state map:

```tsx
            ? [0, 1, 2, 3, 4].map((i) => (
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke (recommended)**

Run the app; with a saved 5-slot GC pick, check `/home` (pre-race card after lock), `/picks` (strip), and `/me` all show 1st–5th.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/picks/pre-race-strip.tsx" "src/app/(app)/home/pre-race-card.tsx" "src/app/(app)/me/page.tsx"
git commit -m "feat(ui): show GC 4th & 5th place on home, picks strip, and me page"
```

---

### Task 10: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the entire unit suite**

Run: `npx vitest run`
Expected: PASS, including `gc.test.ts`, `jersey.test.ts`, `board-gc.test.ts`.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Lint**

Run: the project's lint script (e.g. `npm run lint`)
Expected: clean (or no new violations in touched files).

- [ ] **Step 4: Integration suite (if a Supabase test DB is available)**

Run: `npx supabase db reset && SUPABASE_INTEGRATION=1 npx vitest run src/test/integration`
Expected: PASS — notably `submit-gc-jersey` (5 distinct), `admin-publish-final` (200 / 25 GC), and existing `leaderboard-*` tests.

- [ ] **Step 5: Final commit (if any lint/format fixups were needed)**

```bash
git add -A
git commit -m "chore: verification fixups for GC top 5" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- Scoring 25 exact / no partial credit for 4/5 → Task 1 (TS), Task 3 (SQL). ✓
- Top-3 partial credit unchanged + podium scoped to 1–3 → Task 1 + Task 3 (`fc2.position between 1 and 3`). ✓
- Data model extend gc_picks + final_classifications to 1–5 → Task 3 (constraints). ✓
- Player form Top 5 + distinctness + copy → Task 6. ✓
- Validation/action 5 positions → Task 4. ✓
- Admin publish 4th/5th + form + loader → Task 5. ✓
- Display surfaces (strip, home card, me, board) → Tasks 8 & 9. ✓
- Jersey drift fix → Task 2. ✓
- Tests (gc unit, leaderboard integration, form/action) → Tasks 1, 4, 5, 7 + Task 10. ✓
- GC section max 200 → reflected in form copy (Task 6) and admin test assertion (Task 5). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `submitGcPicksCore` input `{first..fifth}` matches both action callers and tests; `BoardGcByPlayerRow.picks.p1..p5` and `BoardGcByRiderRow.p1Names..p5Names` are defined in Task 7 and consumed in Task 8; `Slot5` tuple used consistently in Task 6; `final_classifications_position_check` is the verified current constraint name. ✓

**Open item for user review:** Task 8's bib-only board cells (6-column mobile constraint) is a UI judgment call — flagged in the handoff.
