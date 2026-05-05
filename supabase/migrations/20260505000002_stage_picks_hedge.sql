alter table public.stage_picks
  add column hedge_rider_id uuid references public.riders(id),
  add constraint stage_picks_primary_ne_hedge
    check (hedge_rider_id is null or hedge_rider_id != rider_id);

create index stage_picks_hedge_rider_idx on public.stage_picks(hedge_rider_id)
  where hedge_rider_id is not null;
