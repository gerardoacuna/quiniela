-- Per-user, per-edition computed scores and tiebreaker counts.

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
      pjp.user_id,
      pjp.edition_id,
      case
        when pjp.rider_id = fc.rider_id then 30
        else 0
      end as jersey_points
    from public.points_jersey_picks pjp
    left join public.final_classifications fc
      on fc.edition_id = pjp.edition_id
     and fc.kind       = 'points_jersey'
     and fc.position   = 1
     and fc.status     = 'published'
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
