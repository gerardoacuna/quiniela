# Board pick reveal — Design

**Date:** 2026-05-08
**Status:** Draft, awaiting user review

## Goal

Let every player see other players' picks once those picks are locked. Specifically: extend visibility from the existing `/stage/[n]` "Who picked whom" card (which already reveals stage *primary* picks at stage start) to also cover **stage underdog picks** (same stage-start lock) and **GC top-3 + jersey picks** (revealed at edition start, i.e. stage 1 start). Pre-lock, surface a small placeholder showing how many players have locked in.

The current schema defines only two jersey kinds — `'points'` and `'white'` — via the `jersey_kind` enum. There is no KOM/mountain jersey. All UI and helpers in this spec assume that two-kind shape; if a third kind is added later, only the jersey query helper and the jersey section's render code need updating.

## Decisions (Q&A summary)

| | |
|---|---|
| Pick types covered | Stage underdog (already partially built path), GC top-3, jerseys (points + white — the two `jersey_kind` enum values in this edition). Stage primary already done. |
| Surface for stage underdog | Extend existing `/stage/[n]` "Who picked whom" card; merge underdog chips into the same rider-grouped view with a small "underdog" badge. |
| Surface for GC + jersey reveals | Two new sections appended to `/board`, below the leaderboard table. |
| Per-section display model | Two stacked sub-cards per section: **player-grouped** (one row per player, sorted by leaderboard rank) AND **rider-grouped** (consensus, one row per rider with picker chips). |
| Pre-lock state | Placeholder card showing `${submissionCount} of ${totalPlayers} players have locked in their GC/jerseys. Reveals at stage 1 start.` |
| Sort order | Player-grouped views ordered by leaderboard rank (current player not pinned — leaderboard view already highlights "you"). |
| Architecture | **Approach B**: each new `/board` section is a self-contained server component with its own query helper, rendered in its own `<Suspense>` boundary. Underdog reveal is a small in-place edit to `getStageDetail` and `WhoPickedWhomCard`. |
| Visibility enforcement | RLS-only. `gc_read_started`, `jersey_picks_read_after_start`, `stage_picks_read_locked` already gate this server-side. App code never branches on `now()` for visibility — only for placeholder-vs-cards rendering. |

## Architecture

Two independent workstreams, no shared code:

1. **`/stage/[n]` underdog reveal.** In-place extension of `getStageDetail` to fetch underdog rider joins on `stage_picks` and emit one entry per (user, kind) into `allPicks`. `WhoPickedWhomCard` adds an "underdog" badge on chips where `kind === 'underdog'`. Grouping key remains `rider.id`, so a rider chosen by Alice as primary and Bob as underdog renders one rider row with two differently-tagged chips.

2. **`/board` GC and jersey reveals.** Two new self-contained server components, each fetching its own data and rendered in its own `<Suspense>` boundary so they stream independently of the leaderboard and of each other:

   - `<EveryonesGc editionId currentUserId totalPlayers playerOrder />`
   - `<EveryonesJerseys editionId currentUserId totalPlayers playerOrder />`

`/board/page.tsx` keeps its existing leaderboard fetch and passes `totalPlayers = rows.length` plus `playerOrder = ranked.map(r => r.user_id)` down — no extra query for the denominator or sort order.

A tiny piece of new DB work: two `security definer` SQL functions (`gc_submission_count`, `jersey_submission_count`) so pre-lock clients can see a count without exposing individual rows.

## Section 1 — Data model

No new tables, no schema changes on existing tables. The data already exists in `gc_picks`, `jersey_picks`, and `stage_picks.underdog_rider_id`. The only new DB artifact is a pair of SQL helper functions:

```sql
create or replace function public.gc_submission_count(edition_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::int
    from public.gc_picks
   where edition_id = gc_submission_count.edition_id;
$$;

grant execute on function public.gc_submission_count(uuid) to authenticated;

create or replace function public.jersey_submission_count(edition_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::int
    from public.jersey_picks
   where edition_id = jersey_submission_count.edition_id;
$$;

grant execute on function public.jersey_submission_count(uuid) to authenticated;
```

For jerseys, "submitted" = the player has at least one row in `jersey_picks` for this edition (one row per `(user, edition, kind)`). A player who submitted only the `points` jersey but not the `white` is still counted as having "locked in jerseys" — partial fills don't show up as a separate pre-lock state. The post-lock UI shows em-dashes for the kinds they didn't fill.

Both `stable` (plan-cacheable), both `set search_path = public` (matches the convention of `is_admin()` and `edition_started()` already in the RLS migration).

After applying:

```
npm run db:types
```

Regenerates `src/lib/types/database.ts` with the new RPC signatures.

## Section 2 — Query helpers

### `src/lib/queries/board-gc.ts`

```ts
export interface BoardGcData {
  isLocked: boolean;
  submissionCount: number;
  byPlayer: Array<{
    userId: string;
    displayName: string;
    picks: {
      p1: { id: string; name: string; team: string | null; bib: number | null } | null;
      p2: { id: string; name: string; team: string | null; bib: number | null } | null;
      p3: { id: string; name: string; team: string | null; bib: number | null } | null;
    };
  }>;
  byRider: Array<{
    rider: { id: string; name: string; team: string | null; bib: number | null };
    p1Names: string[];
    p2Names: string[];
    p3Names: string[];
  }>;
}

export async function getBoardGcData(
  editionId: string,
  currentUserId: string,
): Promise<BoardGcData>;
```

Implementation:

1. `Promise.all` over: (a) `select` from `gc_picks` for the edition with rider + profile joins, (b) RPC `gc_submission_count`, (c) `select start_time` from `stages` where `number = 1` (to derive `isLocked`).
2. RLS gates (a). Pre-lock the SELECT returns only the caller's row (or empty); we ignore it for byPlayer/byRider construction in that branch.
3. Build `byPlayer` indexed by `user_id`, then map across `playerOrder` to produce a stable, leaderboard-ordered list. Players in `playerOrder` with no GC pick get a row with all three slots null.
4. Build `byRider` by walking each pick's three positions, accumulating names per rider per position. Sort outer by total pickers desc; sort inner names alphabetically with "You" pinned first.

### `src/lib/queries/board-jerseys.ts`

Symmetric. `BoardJerseysData.byPlayer` rows have:

```ts
picks: {
  points: { id, name, team, bib } | null;
  white:  { id, name, team, bib } | null;
}
```

`byRider` is a `Record<'points' | 'white', Array<{ rider, names: string[] }>>` keyed by jersey kind, each ordered by pick count desc. The `jersey_picks` table is `(user, edition, kind, rider)`-keyed, so the helper pivots from rows-per-(user, kind) into rows-per-user with the kind as a property.

### Why a separate count RPC

`gc_picks` SELECT pre-lock returns only the caller's row, so `count(*)` on the client view would always read 0 or 1. The `security definer` function bypasses RLS to count distinct submitters without exposing rows. Same pattern as `is_admin()` / `edition_started()`.

## Section 3 — Section components

Both new sections live in `src/app/(app)/board/`.

### `everyones-gc.tsx`

```ts
export async function EveryonesGc({
  editionId,
  currentUserId,
  totalPlayers,
  playerOrder,
}: {
  editionId: string;
  currentUserId: string;
  totalPlayers: number;
  playerOrder: string[];
}) {
  const data = await getBoardGcData(editionId, currentUserId);

  if (!data.isLocked) {
    return (
      <PreLockPlaceholder
        title="Everyone's GC"
        count={data.submissionCount}
        total={totalPlayers}
        revealAt="stage 1 start"
      />
    );
  }

  const byPlayer = sortByOrder(data.byPlayer, playerOrder);

  return (
    <section>
      <SectionHeader eyebrow="Everyone's GC" title="Locked in" />
      <PlayerGroupedCard rows={byPlayer} currentUserId={currentUserId} />
      <RiderGroupedCard rows={data.byRider} />
    </section>
  );
}
```

The four presentational pieces (`SectionHeader`, `PlayerGroupedCard`, `RiderGroupedCard`, `PreLockPlaceholder`) are defined inline in the same file. They aren't reused; co-locating keeps the unit a single readable file (~200 lines).

### `everyones-jerseys.tsx`

Symmetric, with two jersey columns in `<PlayerGroupedCard>` (Points / White) and two sub-blocks in `<RiderGroupedCard>` (one per kind). If `jersey_kind` enum gains a third value later, those two render sites are the only places to update — the helper's `Record<'points' | 'white', …>` shape will surface the change as a TypeScript error at the call site.

### `board-section-skeleton.tsx`

Tiny shared `<Suspense>` fallback used by both sections — three muted-ink rows in a card frame, matches existing card styling.

## Section 4 — `/board/page.tsx` integration

```ts
export default async function BoardPage() {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const supabase = await createClient();
  const { data: rawRows } = await supabase
    .from('leaderboard_view')
    .select('*')
    .eq('edition_id', edition.id);
  const rows = coerceRows(rawRows);
  const ranked = assignRanks(rows);
  const playerOrder = ranked.map((r) => r.user_id);

  return (
    <>
      <BoardClient rows={ranked} currentUserId={user.id} />
      <Suspense fallback={<BoardSectionSkeleton/>}>
        <EveryonesGc
          editionId={edition.id}
          currentUserId={user.id}
          totalPlayers={ranked.length}
          playerOrder={playerOrder}
        />
      </Suspense>
      <Suspense fallback={<BoardSectionSkeleton/>}>
        <EveryonesJerseys
          editionId={edition.id}
          currentUserId={user.id}
          totalPlayers={ranked.length}
          playerOrder={playerOrder}
        />
      </Suspense>
    </>
  );
}
```

The leaderboard renders immediately; both pick sections stream in independently. If GC's RPC is slow, jerseys still render.

## Section 5 — `/stage/[n]` underdog reveal

### `getStageDetail` (`src/lib/queries/stage-detail.ts`)

`allPicks` shape changes from one entry per stage_picks row to one-or-two entries per row (one per non-null rider id):

```ts
export interface StageDetailData {
  // ... unchanged fields
  allPicks: Array<{
    userId: string;
    displayName: string;
    kind: 'primary' | 'underdog';
    rider: { id: string; name: string; team: string | null; bib: number | null; status: 'active' | 'dnf' | 'dns' };
  }>;
  myPickRiderId: string | null; // remains primary-only — drives "your pick" highlight on results
}
```

Query change: select both rider joins on `stage_picks`, then flat-map each row into 1–2 entries with `kind` populated. RLS already exposes underdog at stage start (the `stage_picks_read_locked` policy operates on the row, which now includes the underdog column).

### `WhoPickedWhomCard` (`src/app/(app)/stage/[stageNumber]/page.tsx`)

Grouping key remains `rider.id`. Each chip in the per-rider names list now carries `kind`; chips with `kind === 'underdog'` render a tiny "underdog" tag inside the chip:

```
[ Alice ] [ Bob · underdog ] [ +3 ]
```

Self-as-"You" treatment continues to apply.

## Section 6 — Pre-lock placeholder

Single shared component pattern across both new sections:

```
┌─────────────────────────────────────────┐
│ EVERYONE'S GC                            │
│                                          │
│   12 of 17 players have locked in        │
│   Reveals at stage 1 start               │
└─────────────────────────────────────────┘
```

Displayed when `isLocked === false`. Count comes from the `*_submission_count` RPC; total is `totalPlayers` prop. No row data leaks pre-lock.

## Section 7 — Error handling, perf, auth

### Error handling

- Supabase `error` from any of the parallel SELECTs in a query helper → throw. The `<Suspense>` boundary surfaces the closest `error.tsx`. Half-rendered sections that silently hide picks would be worse than a section-level error.
- Submission-count RPC failure → log and treat as `0`. Pre-lock placeholder still renders ("0 of 17 players have locked in") — informational, not load-bearing.
- Edition has no stage 1 yet → `isLocked = false`. Placeholder branch.

### Auth

`requireProfile()` already gates page access. `currentUserId` is passed into helpers only for "You"-pinning in display. **Visibility is RLS, full stop.** No `if (!isLocked) return []` guards in app code — that would risk app/DB drift.

### Performance

~17 players × (3 GC riders + 3 jerseys) ≈ 100 rows total per page load. Single Promise.all per section, both sections in parallel via Suspense. No pagination, no caching.

### Cache & revalidation

`/board` is dynamic per request (RLS-driven, cookie-bound). No `revalidate` directive. Pick mutations all happen pre-lock from `/picks/gc` and `/picks/jerseys`; once locked, no writes — no `revalidatePath('/board')` needed from any action.

## Section 8 — Tests

The presentational sub-components live inline inside the server section components and aren't exported, so they aren't unit-tested directly. Coverage follows the codebase's existing split: pure transforms in vitest, RLS in Supabase integration tests, full render in Playwright.

### Vitest, no DB

`src/lib/queries/board-gc.test.ts`:

- `byPlayer` is built in `playerOrder` order; players with no `gc_picks` row produce a row with all three slots null.
- `byRider` groups picks by `rider.id` per position; outer order is by total pick count desc.
- Inside chip lists, the current player ("You") is pinned first, others alphabetical.
- Empty input → empty `byPlayer` and `byRider`.

`src/lib/queries/board-jerseys.test.ts`:

- Same matrix as GC, plus a partial-fill case: a player has only `kind = 'points'` in `jersey_picks`. Their `byPlayer` row shows the points rider and `white: null`. The `byRider['white']` block does not include their name.

These tests mock the Supabase client to return fixed row arrays — they exercise the transform, not the network.

### Integration tests (Supabase, env `SUPABASE_INTEGRATION=1`)

Add cases to `src/test/integration/rls-denials.test.ts`:

- Pre-`edition_started`: user A inserts a GC slate; user B SELECTs `gc_picks` for the edition → only B's own rows. `gc_submission_count` callable and returns the correct distinct count without exposing rows.
- Pre-`edition_started`: same for `jersey_picks` (note: the active table name) and `jersey_submission_count`.
- Post-`edition_started`: A and B can SELECT all GC + jersey rows for the edition.
- Pre-stage-start vs post-stage-start: extend the stage_picks RLS test to assert user B's `underdog_rider_id` is hidden / visible accordingly through `stage_picks_read_locked`. The policy already guards this — the test confirms it doesn't regress when consumers start reading the column.

### E2E (Playwright)

`e2e/board-pick-reveal.spec.ts`:

- Seed: edition, 3 players, GC + jersey picks for each, stage 1 `start_time` **future** → log in as one player, visit `/board`, assert both new sections render the placeholder with the correct count and no opponent picks are present in the DOM.
- Same fixture with stage 1 `start_time` **past** → assert player-grouped rows in leaderboard order and rider-grouped consensus blocks render with all three players' chips.
- `/stage/1` with stage 1 `start_time` **past** + seeded primary + underdog picks → assert at least one chip in the existing "Who picked whom" card renders the "underdog" badge.

## Section 9 — Migrations

```
supabase/migrations/
  20260508000001_pick_submission_counts.sql   — gc_submission_count + jersey_submission_count, both security definer
```

After applying:

```
npm run db:types
```

### Backwards compatibility

Purely additive. The two new functions don't touch existing tables, RLS policies, or views. `getStageDetail` shape extension adds a `kind` field per pick entry — existing stage page code paths continue to work because the grouping key (`rider.id`) is unchanged.

## Out of scope

- Per-player profile pages (drill into a single player's full picks). Considered and rejected during brainstorming.
- Pre-lock countdown on placeholders. `/home` already shows similar info.
- Pre-lock leaderboard for "consensus picks" (e.g., riders most/least picked) before reveal — would require a different aggregate that doesn't expose individual submitters; skip.
- Notifications / activity feed when picks are locked.
- Animations or transitions for the moment of reveal.

## Done criteria

1. `gc_submission_count` and `jersey_submission_count` SQL functions exist, executable by `authenticated`.
2. `getBoardGcData` and `getBoardJerseysData` query helpers return strict shapes; vitest transforms covered.
3. `EveryonesGc` and `EveryonesJerseys` server components render placeholder pre-lock and full sections post-lock.
4. `/board/page.tsx` renders both sections in `<Suspense>` boundaries below the existing leaderboard.
5. `getStageDetail.allPicks` carries `kind: 'primary' | 'underdog'` and emits one entry per non-null rider id; `WhoPickedWhomCard` chips render the "underdog" tag.
6. RLS integration tests assert pre-lock vs post-lock visibility transitions for GC, jerseys, and stage underdog; pre-lock count RPCs return correct distinct counts without exposing rows.
7. E2E spec passes for pre-lock, post-lock, and underdog badge.
8. Lint, typecheck, vitest, integration green.
