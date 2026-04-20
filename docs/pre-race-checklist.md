# Pre-race operational checklist

Run through this 48 hours before the first counted stage of the Giro.

## T-48h: Data setup

- [ ] Active edition exists in `public.editions` with correct `start_date`, `end_date`, `is_active = true`
- [ ] All 21 stages in `public.stages` with correct `start_time` (UTC!)
- [ ] ~10 stages flagged `counts_for_scoring = true`; subset flagged `double_points = true`
- [ ] Manually trigger `/api/cron/scrape-pcs` (curl + bearer) and verify the `startlist` target succeeds → `riders` table has 170+ rows
- [ ] At least 2 admins exist (`role = 'admin'` in `public.profiles`)
- [ ] All 34 invites sent via `/admin/invites`; at least one player has completed sign-up round-trip

## T-24h: Dry-run

- [ ] Publish a dummy `stage_results` row for a non-counted stage as a drill. Confirm `/admin/errors` logs the audit row. Immediately `resetStageToUpcoming` afterward.
- [ ] Confirm `/` leaderboard loads for a non-admin user within 2 seconds
- [ ] Confirm `/picks` loads for a player within 2 seconds and rider picker is usable on a phone
- [ ] Confirm Resend (or Mailpit for staging) logs show at least one email delivered from an earlier invite

## T-2h: Final checks

- [ ] Both cron jobs show `last_succeeded_at` within the last 2h on `/admin` dashboard
- [ ] No open rows in `scrape_errors` newer than 2h
- [ ] DNS resolving: `dig +short <your-domain>`
- [ ] HTTPS cert valid: `curl -sI https://<your-domain> | grep -i strict-transport-security`

## Incident playbook

**PCS scrape fails for N consecutive runs:**
- Check `/admin/errors` for the specific target (`stage-N`, `startlist`, `final-gc`)
- If the parser broke (PCS redesigned their HTML): roll back to the last green deploy with `vercel rollback <url>`, patch parser locally against a fresh fixture, push fix
- If Cloudflare blocks: update `PCS_USER_AGENT` env var; consider adding 429 backoff

**Reminder cron sends no emails:**
- Check `RESEND_API_KEY` valid and `EMAIL_FROM` is a verified sender domain
- Check `SUPABASE_SMTP_*` fallback if Resend not configured
- Manually trigger `/api/cron/send-reminders` and inspect the JSON response

**Player can't sign in:**
- Confirm Supabase Auth → URL Configuration still lists `https://<your-domain>/auth/callback`
- Check Supabase logs for the specific user (Dashboard → Auth → Logs)

**Leaderboard shows 0 for a confirmed pick:**
- SQL: `select * from leaderboard_view where user_id = '<id>'` — if empty, the `profiles` row is missing or `deleted_at` is set
- SQL: `select * from stage_results where stage_id = '<id>'` — if empty, admin didn't publish

**Rollback:**
```
vercel rollback <previous-deployment-url>
```

Database migrations are forward-only; if a migration broke prod, restore from Supabase backup (Dashboard → Database → Backups).

## Post-race

- [ ] Publish final GC classification (3 rows) via `/admin/classifications`
- [ ] Publish points jersey winner (1 row) via `/admin/classifications`
- [ ] Verify the winner's row in `leaderboard_view`
- [ ] Flip `edition.is_active = false` to prevent further writes
- [ ] Archive Resend / Mailpit logs
