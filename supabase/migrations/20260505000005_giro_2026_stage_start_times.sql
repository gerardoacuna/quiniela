-- Align Giro 2026 stage start_times with the official RCS Sports calendar.
-- Calendar publishes all 21 stages at 10:00 UTC; prod was placeholder 12:00 UTC.
-- This shifts every stage of the active edition back two hours.
--
-- Effective lock times after this update:
--   Bulgaria stages 1–3 (May 8–10): 10:00 UTC = 13:00 EEST  (≈ 40 min before riders roll out)
--   Italy stages 4–21 (May 12–31): 10:00 UTC = 12:00 CEST  (similar pre-rollout buffer)
--
-- Reversible: `update public.stages set start_time = start_time + interval '2 hours' where edition_id = '1f81b661-42fa-43db-8af3-5c9a2ac4f107';`

update public.stages
set start_time = start_time - interval '2 hours'
where edition_id = '1f81b661-42fa-43db-8af3-5c9a2ac4f107';
