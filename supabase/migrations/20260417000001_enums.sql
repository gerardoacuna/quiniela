-- Enums used across the schema.

create type public.user_role as enum ('player', 'admin');

create type public.stage_status as enum (
  'upcoming',
  'locked',
  'results_draft',
  'published',
  'cancelled'
);

create type public.rider_status as enum ('active', 'dnf', 'dns');

create type public.result_status as enum ('draft', 'published');

create type public.classification_kind as enum ('gc', 'points_jersey');
