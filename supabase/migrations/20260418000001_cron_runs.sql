create table public.cron_runs (
  job_name             text primary key,
  last_started_at      timestamptz,
  last_succeeded_at    timestamptz,
  last_error           text,
  consecutive_failures int not null default 0
);

alter table public.cron_runs enable row level security;

create policy "cron_runs_read_admin" on public.cron_runs
  for select to authenticated using (public.is_admin());

-- Writes happen via service_role only (from cron routes); no user-facing write policy.

insert into public.cron_runs (job_name) values
  ('scrape-pcs'),
  ('send-reminders')
on conflict (job_name) do nothing;
