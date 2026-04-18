-- Core identity and catalog tables.

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         public.user_role not null default 'player',
  email        text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role) where deleted_at is null;

create table public.editions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Only one active edition at a time.
create unique index editions_single_active_idx
  on public.editions((true)) where is_active;

create table public.stages (
  id                    uuid primary key default gen_random_uuid(),
  edition_id            uuid not null references public.editions(id) on delete cascade,
  number                int  not null check (number between 1 and 21),
  start_time            timestamptz not null,
  counts_for_scoring    boolean not null default false,
  double_points         boolean not null default false,
  status                public.stage_status not null default 'upcoming',
  created_at            timestamptz not null default now(),
  unique (edition_id, number)
);

create index stages_edition_idx on public.stages(edition_id);
create index stages_start_time_idx on public.stages(start_time);

create table public.riders (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references public.editions(id) on delete cascade,
  pcs_slug     text not null,
  name         text not null,
  team         text,
  bib          int,
  status       public.rider_status not null default 'active',
  created_at   timestamptz not null default now(),
  unique (edition_id, pcs_slug)
);

create index riders_edition_idx on public.riders(edition_id);
create index riders_status_idx on public.riders(edition_id, status);
