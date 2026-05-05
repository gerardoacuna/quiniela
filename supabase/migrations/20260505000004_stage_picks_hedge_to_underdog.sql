-- Rebrand: "hedge" rider → "underdog" rider.
-- Renames column, check constraint, and partial index. Recreates leaderboard_view
-- to use the new column name.

alter table public.stage_picks
  rename column hedge_rider_id to underdog_rider_id;

alter table public.stage_picks
  rename constraint stage_picks_primary_ne_hedge to stage_picks_primary_ne_underdog;

alter index public.stage_picks_hedge_rider_idx
  rename to stage_picks_underdog_rider_idx;

alter table public.stage_picks
  rename constraint stage_picks_hedge_rider_id_fkey to stage_picks_underdog_rider_id_fkey;

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
