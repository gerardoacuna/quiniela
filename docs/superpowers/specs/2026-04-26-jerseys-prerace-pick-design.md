# Jerseys pre-race pick — design

**Date:** 2026-04-26
**Status:** approved through brainstorming, awaiting implementation plan

## Context

The pre-race pickem currently has two slots: GC top-3 and a single "points jersey" pick. We want to add a **white jersey** (best young rider) pick and, while we're at it, generalize the data model so future jerseys (e.g. KOM/blue) require no further refactor. Existing prod has zero rows in `points_jersey_picks` today, so the migration is genuinely cheap.

The goal: a single combined `/picks/jerseys` page that handles both pre-race jersey picks, with no behavioral changes to GC.

## Decisions

1. **Eligibility:** open picker. Any active rider is selectable for either jersey. The app does not enforce age constraints for the white jersey.
2. **Schema:** unified `jersey_picks` table with a `kind` enum (`points`, `white`). Replaces `points_jersey_picks`.
3. **Scoring:** **50 points** for an exact match, 0 otherwise. Applies to both jersey kinds. Bumped from the previous 30 for the points jersey.
4. **UI:** one combined picker at `/picks/jerseys` with two stacked rider selectors and a single submit. Old `/picks/jersey` URL redirects to it.
5. **Deadline:** Stage 1 start time (race start, May 8 12:00 UTC). Same gate as GC and the previous points-jersey pick.

## Data model

### New migration: `supabase/migrations/20260427000001_jersey_picks.sql`

```sql
create type public.jersey_kind as enum ('points', 'white');

create table public.jersey_picks (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  edition_id  uuid not null references public.editions(id) on delete cascade,
  kind        public.jersey_kind not null,
  rider_id    uuid not null references public.riders(id),
  updated_at  timestamptz not null default now(),
  primary key (user_id, edition_id, kind)
);

create trigger jersey_picks_set_updated_at
  before update on public.jersey_picks
  for each row execute function public.tg_set_updated_at();

alter type public.classification_kind add value 'white_jersey';

-- Extend the position check on final_classifications so white_jersey rows
-- with position = 1 are valid. The existing constraint only whitelists 'gc'
-- (1–3) and 'points_jersey' (1). It was created anonymously, so we drop by
-- looking up the actual conname rather than guessing it.
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.final_classifications'::regclass
    and contype = 'c';
  if c is not null then
    execute format('alter table public.final_classifications drop constraint %I', c);
  end if;
end$$;

alter table public.final_classifications
  add constraint final_classifications_position_check check (
    (kind = 'gc'            and position between 1 and 3) or
    (kind = 'points_jersey' and position = 1) or
    (kind = 'white_jersey'  and position = 1)
  );

-- RLS clones the patterns on points_jersey_picks
alter table public.jersey_picks enable row level security;

create policy "jersey_picks_read_self" on public.jersey_picks
  for select to authenticated
  using (user_id = auth.uid());

create policy "jersey_picks_read_after_start" on public.jersey_picks
  for select to authenticated
  using (public.edition_started(edition_id));

create policy "jersey_picks_write_self" on public.jersey_picks
  for all to authenticated
  using (user_id = auth.uid() and not public.edition_started(edition_id))
  with check (user_id = auth.uid() and not public.edition_started(edition_id));

drop table public.points_jersey_picks;
```

### Leaderboard view recreate

Migration also `create or replace view public.leaderboard_view` so the `jersey_scoring` CTE reads from `public.jersey_picks` and joins `public.final_classifications` on `kind in ('points_jersey', 'white_jersey')`. Sums to a single `jersey_points` column (50 per match).

### Migration impact on prod

- `points_jersey_picks` has 0 rows — clean drop.
- `auth.users`, `profiles`, `editions`, `riders`, `stages`, `gc_picks`, `final_classifications`, all preserved.
- Run in prod via `supabase db push`.

## Server action + scoring

### `src/lib/scoring/jersey.ts`

```ts
export const JERSEY_POINTS = 50;
export function jerseyPoints(
  pick: { rider_id: string },
  winner: { rider_id: string } | null,
): number {
  return winner && pick.rider_id === winner.rider_id ? JERSEY_POINTS : 0;
}
```

Same scorer is used for both `points` and `white` jersey rows in the leaderboard CTE.

### `src/lib/actions/picks.ts`

Replace `submitJerseyPickCore` (and its public `submitJerseyPick`) with a single `submitJerseyPicksCore` taking both rider IDs:

```ts
async function submitJerseyPicksCore(
  supabase,
  userId,
  input: { editionId: string; pointsRiderId: string; whiteRiderId: string },
): Promise<ActionResult>
```

Validation flow (mirrors current jersey logic):
- Both riders exist, belong to `input.editionId`, and have `status = 'active'`.
- Stage 1 still in the future — otherwise return `jersey_locked`.
- Riders may be the same across kinds (no uniqueness rule); explicit assertion in tests.
- Upsert two rows in `jersey_picks` on conflict `(user_id, edition_id, kind)`.

The form submits both selections in one form post. Partial picks aren't allowed at submit time — both fields are required.

## UI

### Combined picker `/picks/jerseys`

- New `src/app/(app)/picks/jerseys/page.tsx` (Server Component) loads Stage 1 deadline, active riders, and the user's two existing `jersey_picks` rows.
- New `src/app/(app)/picks/jerseys/form.tsx` (Client Component) renders two stacked rider-picker cards inside one `<form>`. Each card has its own jersey-color glyph, mono eyebrow ("Points jersey" / "White jersey"), search/select, and current-selection chip.
- One **"Save jersey picks"** submit button posts to `submitJerseyPicks`.
- Locked state (now > Stage 1 start_time): renders both picks as read-only chips, hides the submit, surfaces a "Locked at race start" `var(--ink-mute)` notice.

### URL backward-compat

`src/app/(app)/picks/jersey/page.tsx` becomes a one-liner: `redirect('/picks/jerseys')`.

### Pre-race card on `/home`

`src/app/(app)/home/pre-race-card.tsx` renders two jersey rows instead of one, both linked to `/picks/jerseys`. Existing layout preserved.

### `/me` page

`src/app/(app)/me/page.tsx` lists both jersey picks under "Pre-race picks". `getMeData()` (queries/me.ts) extends to fetch both kinds.

### Tokens

Add `--jersey-white: #ffffff` to `src/app/globals.css`. The existing `JerseyGlyph` atom already accepts a `color` prop; the white variant uses `var(--jersey-white)` with the existing `var(--hair)` outline so it reads on dark surfaces.

## Tests

### New

- `src/lib/scoring/jersey.test.ts` (update): assert `JERSEY_POINTS === 50`. Cover same scorer for both kinds.
- `src/test/integration/submit-jerseys.test.ts` (new): happy path saves both kinds in one call; locked-stage rejection (`jersey_locked`); rider-wrong-edition rejection; rider-not-active rejection; same-rider-for-both-kinds explicitly allowed.
- `src/test/integration/leaderboard-jerseys.test.ts` (new): with both jersey picks + matching `final_classifications` rows, leaderboard returns `jersey_points = 100`. One-match → 50. No-match → 0.

### Updated

- `src/test/integration/submit-gc-jersey.test.ts`: drop the jersey-pick portion (covered by `submit-jerseys.test.ts`); keep GC tests intact.
- `src/test/integration/admin-publish-final.test.ts`: extend to publish a `white_jersey` row alongside `points_jersey`; assert both flow through to scoring.
- `src/test/integration/cron-scrape.test.ts`: change teardown from `delete from points_jersey_picks` to `delete from jersey_picks`.
- Type-generation: `npm run db:types` regenerates `src/lib/types/database.ts` after the migration runs locally.

## Manual verification checklist

1. `supabase db reset` (local), `npm run dev`. Sign up, navigate to `/picks/jerseys`, submit both jerseys, verify two rows appear in `jersey_picks` (one per kind).
2. Visit `/picks/jersey` → redirects to `/picks/jerseys` (Next.js `redirect()` returns 307 by default).
3. Type `npm run typecheck && npm run lint && npm run test` — all green.
4. Push migration to prod (`supabase db push`). Confirm `select count(*) from auth.users`, `from profiles`, `from editions`, `from riders`, `from stages` are unchanged.
5. Home pre-race card on prod shows two jersey rows.
6. `/me` on prod shows two jersey picks (or `—` placeholders if not yet submitted).

## Out of scope

- KOM/blue jersey pick (no schema reservation needed; the `jersey_kind` enum can be extended later by adding `'kom'`).
- Eligibility filtering for the white jersey (open picker, by decision).
- UI for KOM jersey on the pre-race card.
- Migrating any user data (none exists for points_jersey_picks).
