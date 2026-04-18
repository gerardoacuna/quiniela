-- Game state: picks, results, invites, audit.

create table public.stage_picks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  stage_id   uuid not null references public.stages(id)   on delete cascade,
  rider_id   uuid not null references public.riders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stage_id)
);

create index stage_picks_stage_idx on public.stage_picks(stage_id);
create index stage_picks_user_idx  on public.stage_picks(user_id);

create table public.gc_picks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  edition_id uuid not null references public.editions(id) on delete cascade,
  position   int  not null check (position between 1 and 3),
  rider_id   uuid not null references public.riders(id),
  updated_at timestamptz not null default now(),
  primary key (user_id, edition_id, position)
);

create table public.points_jersey_picks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  edition_id uuid not null references public.editions(id) on delete cascade,
  rider_id   uuid not null references public.riders(id),
  updated_at timestamptz not null default now(),
  primary key (user_id, edition_id)
);

create table public.stage_results (
  stage_id   uuid not null references public.stages(id) on delete cascade,
  position   int  not null check (position between 1 and 10),
  rider_id   uuid not null references public.riders(id),
  status     public.result_status not null default 'draft',
  updated_at timestamptz not null default now(),
  primary key (stage_id, position)
);

create table public.final_classifications (
  edition_id uuid not null references public.editions(id) on delete cascade,
  kind       public.classification_kind not null,
  position   int  not null,
  rider_id   uuid not null references public.riders(id),
  status     public.result_status not null default 'draft',
  updated_at timestamptz not null default now(),
  primary key (edition_id, kind, position),
  check (
    (kind = 'gc'            and position between 1 and 3) or
    (kind = 'points_jersey' and position = 1)
  )
);

-- invites.created_by is nullable with on delete set null to preserve audit trail.
-- If an admin profile is hard-deleted, their invite rows survive with created_by = NULL,
-- which is a recoverable audit gap; cascading would lose "who invited whom" forever.
create table public.invites (
  code        text primary key,
  created_by  uuid references public.profiles(id) on delete set null,
  email       text not null,
  used_at     timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index invites_email_idx on public.invites(email);

create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  target     jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_actor_idx on public.audit_log(actor_id);
create index audit_log_action_idx on public.audit_log(action);

create table public.scrape_errors (
  id           uuid primary key default gen_random_uuid(),
  run_at       timestamptz not null default now(),
  target       text not null,
  error        text not null,
  html_snippet text
);

create table public.pick_reminders_sent (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  stage_id uuid not null references public.stages(id)   on delete cascade,
  sent_at  timestamptz not null default now(),
  primary key (user_id, stage_id)
);

-- Trigger to auto-update updated_at on picks / results.
create or replace function public.tg_set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger stage_picks_set_updated
  before update on public.stage_picks
  for each row execute function public.tg_set_updated_at();

create trigger gc_picks_set_updated
  before update on public.gc_picks
  for each row execute function public.tg_set_updated_at();

create trigger points_jersey_picks_set_updated
  before update on public.points_jersey_picks
  for each row execute function public.tg_set_updated_at();

create trigger stage_results_set_updated
  before update on public.stage_results
  for each row execute function public.tg_set_updated_at();

create trigger final_classifications_set_updated
  before update on public.final_classifications
  for each row execute function public.tg_set_updated_at();
