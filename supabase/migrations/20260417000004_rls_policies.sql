-- Helper: is the current auth.uid() an admin?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deleted_at is null
  );
$$;

-- Helper: has Stage 1 of the given edition reached its start_time?
-- GC and jersey picks are editable until this moment (wall-clock based, not status-based).
create or replace function public.edition_started(edition_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stages s
    where s.edition_id = edition_started.edition_id
      and s.number = 1
      and s.start_time <= now()
  );
$$;

-- Enable RLS on all application tables.
alter table public.profiles               enable row level security;
alter table public.editions               enable row level security;
alter table public.stages                 enable row level security;
alter table public.riders                 enable row level security;
alter table public.stage_picks            enable row level security;
alter table public.gc_picks               enable row level security;
alter table public.points_jersey_picks    enable row level security;
alter table public.stage_results          enable row level security;
alter table public.final_classifications  enable row level security;
alter table public.invites                enable row level security;
alter table public.audit_log              enable row level security;
alter table public.scrape_errors          enable row level security;
alter table public.pick_reminders_sent    enable row level security;

-- profiles: all authed read; self-update display_name; admins update role
create policy "profiles_read_authed" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated
  with check (public.is_admin() or id = auth.uid());

-- editions, stages, riders: all authed read; admin write
create policy "editions_read_authed"  on public.editions  for select to authenticated using (true);
create policy "editions_write_admin"  on public.editions  for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "stages_read_authed"    on public.stages    for select to authenticated using (true);
create policy "stages_write_admin"    on public.stages    for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "riders_read_authed"    on public.riders    for select to authenticated using (true);
create policy "riders_write_admin"    on public.riders    for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- stage_picks
create policy "stage_picks_read_self" on public.stage_picks
  for select to authenticated using (user_id = auth.uid());

create policy "stage_picks_read_locked" on public.stage_picks
  for select to authenticated using (
    exists (
      select 1 from public.stages s
      where s.id = stage_picks.stage_id
        and s.start_time <= now()
    )
  );

create policy "stage_picks_write_self_unlocked" on public.stage_picks
  for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.stages s
      where s.id = stage_picks.stage_id
        and s.start_time > now()
        and s.status != 'cancelled'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.stages s
      where s.id = stage_picks.stage_id
        and s.start_time > now()
        and s.status != 'cancelled'
    )
  );

-- gc_picks / points_jersey_picks
create policy "gc_read_self" on public.gc_picks
  for select to authenticated using (user_id = auth.uid());

create policy "gc_read_started" on public.gc_picks
  for select to authenticated using (public.edition_started(edition_id));

create policy "gc_write_self_pre_start" on public.gc_picks
  for all to authenticated
  using (user_id = auth.uid() and not public.edition_started(edition_id))
  with check (user_id = auth.uid() and not public.edition_started(edition_id));

create policy "jersey_read_self" on public.points_jersey_picks
  for select to authenticated using (user_id = auth.uid());

create policy "jersey_read_started" on public.points_jersey_picks
  for select to authenticated using (public.edition_started(edition_id));

create policy "jersey_write_self_pre_start" on public.points_jersey_picks
  for all to authenticated
  using (user_id = auth.uid() and not public.edition_started(edition_id))
  with check (user_id = auth.uid() and not public.edition_started(edition_id));

-- stage_results / final_classifications
create policy "stage_results_read_published" on public.stage_results
  for select to authenticated using (status = 'published' or public.is_admin());

create policy "stage_results_write_admin" on public.stage_results
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "final_read_published" on public.final_classifications
  for select to authenticated using (status = 'published' or public.is_admin());

create policy "final_write_admin" on public.final_classifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- invites, audit_log, scrape_errors, pick_reminders_sent
create policy "invites_admin" on public.invites
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "audit_log_read_admin" on public.audit_log
  for select to authenticated using (public.is_admin());

create policy "scrape_errors_read_admin" on public.scrape_errors
  for select to authenticated using (public.is_admin());

create policy "pick_reminders_read_admin" on public.pick_reminders_sent
  for select to authenticated using (public.is_admin());
