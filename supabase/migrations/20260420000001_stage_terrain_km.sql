-- Add terrain enum + km column for stage UX context.
create type public.stage_terrain as enum ('flat', 'hilly', 'mountain', 'itt');

alter table public.stages
  add column terrain public.stage_terrain not null default 'flat',
  add column km integer not null default 0 check (km >= 0 and km <= 400);

comment on column public.stages.terrain is 'Course profile category used in player UI';
comment on column public.stages.km is 'Stage length in kilometres';
