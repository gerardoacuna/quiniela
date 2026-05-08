-- Pre-lock submission counts.
--
-- gc_picks and jersey_picks are gated by the `*_read_after_start` and
-- `gc_read_started` RLS policies — pre-lock a non-admin SELECT only sees the
-- caller's row. To render "12 of 17 players have locked in" placeholders on
-- /board before the edition starts, we need a count that bypasses RLS but
-- exposes ONLY an aggregate, never row-level data.
--
-- Pattern mirrors public.is_admin() and public.edition_started():
-- security definer + set search_path = public, stable, narrow grant.

create or replace function public.gc_submission_count(edition_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct user_id)::int
    from public.gc_picks
   where edition_id = gc_submission_count.edition_id;
$$;

grant execute on function public.gc_submission_count(uuid) to authenticated;

create or replace function public.jersey_submission_count(edition_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct user_id)::int
    from public.jersey_picks
   where edition_id = jersey_submission_count.edition_id;
$$;

grant execute on function public.jersey_submission_count(uuid) to authenticated;
