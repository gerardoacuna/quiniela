# Plan C smoke walkthrough — 2026-04-19

Environment: local Supabase (`supabase db reset` seeded) + `next dev` on :3000, Mailpit on :54324, CRON_SECRET from `.env.local`.

| Step | Area | Result |
|------|------|--------|
| 1 | Admin dashboard (`/admin`) loads with counts + empty cron rows | ✅ |
| 2 | Edition setup (`/admin/edition`) persists `counts_for_scoring` / `double_points` toggles | ✅ |
| 3 | Stage 9 publish (`/admin/stages/9`) — top-3 riders saved and leaderboard awards points to matching picks | ✅ |
| 4 | Roster role toggles (`/admin/roster`) — promote/demote flow | ✅ |
| 5 | `curl /api/cron/scrape-pcs` — bearer-secret accepted, JSON summary returned | ✅ |
| 6 | `curl /api/cron/send-reminders` — reminder emails appear in Mailpit, dedup holds on second call | ✅ |
| 7 | `/admin/errors` — scrape_errors + audit_log tables render | ✅ |

No rough edges surfaced. Ready for final code review.
