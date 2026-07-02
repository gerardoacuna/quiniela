-- GO-LIVE: switch the active edition from the Giro to the Tour de France 2026.
-- Apply MANUALLY when ready, e.g.:
--   psql "$SUPABASE_DB_URL" -f scripts/ops/activate-tour-2026.sql
-- One transaction so editions_single_active_idx is never violated.
-- To roll back, re-activate the previous edition by slug.
begin;
update public.editions set is_active = false where is_active = true;
update public.editions set is_active = true  where slug = 'tour-de-france-2026';
commit;
