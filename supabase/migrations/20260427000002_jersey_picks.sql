-- 1. Unified jersey_picks table.
create type public.jersey_kind as enum ('points', 'white');

create table public.jersey_picks (
  user_id     uuid not null references public.profiles(id)  on delete cascade,
  edition_id  uuid not null references public.editions(id)  on delete cascade,
  kind        public.jersey_kind not null,
  rider_id    uuid not null references public.riders(id),
  updated_at  timestamptz not null default now(),
  primary key (user_id, edition_id, kind)
);

create trigger jersey_picks_set_updated_at
  before update on public.jersey_picks
  for each row execute function public.tg_set_updated_at();

-- 2. Widen the anonymous CHECK on final_classifications to allow white_jersey
-- at position = 1. The original constraint was created without a name; look it
-- up dynamically rather than guessing.
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

-- 3. RLS — clone the patterns from points_jersey_picks.
alter table public.jersey_picks enable row level security;

create policy "jersey_picks_read_self" on public.jersey_picks
  for select to authenticated
  using (user_id = auth.uid());

create policy "jersey_picks_read_after_start" on public.jersey_picks
  for select to authenticated
  using (public.edition_started(edition_id));

create policy "jersey_picks_write_self_pre_start" on public.jersey_picks
  for all to authenticated
  using      (user_id = auth.uid() and not public.edition_started(edition_id))
  with check (user_id = auth.uid() and not public.edition_started(edition_id));

-- 4. Recreate the leaderboard view so the jersey_scoring CTE reads the new
-- table for both kinds (points + white) and awards 50 pts each on exact match.
create or replace view public.leaderboard_view as
with
  stage_scoring as (
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
          when jp.kind = 'points' and fc_points.rider_id = jp.rider_id then 50
          when jp.kind = 'white'  and fc_white.rider_id  = jp.rider_id then 50
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
  coalesce(st.stage_points, 0)           as stage_points,
  coalesce(gc.gc_points, 0)              as gc_points,
  coalesce(jp.jersey_points, 0)          as jersey_points,
  coalesce(st.stage_points, 0)
    + coalesce(gc.gc_points, 0)
    + coalesce(jp.jersey_points, 0)      as total_points,
  coalesce(st.exact_winners_count, 0)    as exact_winners_count
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

-- 5. Drop the legacy table last, after the view no longer references it.
drop table public.points_jersey_picks;
