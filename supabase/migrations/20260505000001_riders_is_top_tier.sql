alter table public.riders
  add column is_top_tier boolean not null default false;
