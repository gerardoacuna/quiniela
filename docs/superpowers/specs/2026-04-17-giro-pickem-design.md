# Quiniela — Giro d'Italia Pickem: Design Spec

**Date:** 2026-04-17
**Status:** Draft for review
**Scope:** Single edition to start (Giro 2026). Data model supports future editions without schema change.

## 1. Overview

A mobile-first pickem game for a private group of 34 friends. Each participant picks a rider for selected stages of the Giro d'Italia plus pre-race picks for the final GC top 3 and the points jersey winner. Points accumulate over the race; a leaderboard ranks participants, with a tiebreaker based on exact-winner predictions.

### 1.1 Participants and scale

- 34 invited participants.
- 2+ admins.
- English UI.
- Low traffic (<1 req/sec peak). No horizontal scaling concerns.

### 1.2 Game rules (authoritative summary)

- **Counted stages:** ~10 stages flagged by the admin from the Giro's 21. Admin also marks individual stages as **double points**.
- **Stage pick:** one rider per counted stage. A pick is editable any time until that stage's start time, then locks.
- **No-reuse:** a rider can be picked for at most one counted stage per edition. Cancelled stages do not consume a rider.
- **Points per stage** (top 10 finishers): `25, 15, 10, 8, 6, 5, 4, 3, 2, 1`. Doubled on flagged stages.
- **GC top 3 pick:** user picks 1st, 2nd, 3rd (ordered). Submitted before Stage 1; locks when Stage 1 starts. Scored after the Giro's final GC is published:
  - 30 points if the user's pick at position P equals the actual rider at position P,
  - 10 points if the user's pick is in the actual top 3 but at a different position,
  - 0 otherwise. Max 90.
- **Points jersey pick:** user picks one rider. 30 points if correct, 0 otherwise. Same lock rules as GC.
- **Tiebreaker:** total count of "exact winner" stage picks (user's rider finished 1st). Higher wins. If still tied, users share the rank.

### 1.3 Non-goals

- Public signup. Invites are admin-generated only.
- Multiple simultaneous editions. One active edition at a time (Giro 2026 first).
- Native mobile apps. Mobile web + PWA only.
- Social features beyond post-lock pick visibility and a leaderboard.
- Monetization or prizes (out of scope for this spec).

## 2. Architecture

Single Next.js 16 application on Vercel (Fluid Compute, Node 24). Supabase provides Postgres, magic-link auth, and transactional email.

```
┌──────────────────────────────────────┐
│     Client (mobile web / PWA)        │
│     Next.js App Router components    │
└──────────────┬───────────────────────┘
               │ HTTPS
┌──────────────▼───────────────────────┐
│     Vercel (Fluid Compute)           │
│  ┌────────────┐  ┌────────────────┐  │
│  │ App Routes │  │ Server Actions │  │
│  └────────────┘  └────────────────┘  │
│  ┌─────────────────────────────────┐ │
│  │ Cron Routes                     │ │
│  │  /api/cron/scrape-pcs           │ │
│  │  /api/cron/send-reminders       │ │
│  └─────────────────────────────────┘ │
└──────┬───────────────────────────┬───┘
       │ @supabase/ssr             │ fetch
┌──────▼───────────┐     ┌─────────▼──────────┐
│ Supabase         │     │ procyclingstats.com│
│  Postgres + RLS  │     │ (scraped HTML)     │
│  Auth (magic)    │     └────────────────────┘
│  SMTP (email)    │
└──────────────────┘
```

### 2.1 Stack choices

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 App Router | RSC + Server Actions remove the API layer; idiomatic on Vercel |
| Runtime | Node 24 (Fluid Compute) | Full Node for scraping libs; lower cold starts than classic serverless |
| Styling | Tailwind + shadcn/ui | Fast, clean, mobile-friendly defaults |
| Language | TypeScript | End-to-end typing |
| DB + Auth | Supabase | Single provider for Postgres, RLS, magic-link auth, SMTP |
| Scraping | node-html-parser or cheerio | Parse PCS HTML server-side |
| Testing | Vitest + Playwright | Unit/integration in Vitest; smoke E2E in Playwright |
| Mobile | PWA (manifest + service worker) | App-like install on iOS/Android without native code |

### 2.2 Deployment

- Vercel project linked to the repo.
- Supabase project provisioned via the Vercel Marketplace integration so env vars auto-sync.
- Vercel Cron: one job every 15 min during the race window, one hourly for reminders.
- Branch previews for visual QA.

## 3. Data model

All tables use `auth.users` as the identity root. RLS is enabled on every table. Enums are Postgres enums.

```
profiles
  id                 uuid pk (= auth.users.id)
  display_name       text not null
  role               enum('player','admin') default 'player'
  email              text
  deleted_at         timestamptz
  created_at         timestamptz default now()

editions
  id                 uuid pk
  slug               text unique          -- 'giro-2026'
  name               text
  start_date, end_date  date
  is_active          bool

stages
  id                 uuid pk
  edition_id         uuid fk
  number             int check (number between 1 and 21)
  start_time         timestamptz          -- stage lock time
  counts_for_scoring bool default false
  double_points      bool default false
  status             enum('upcoming','locked','results_draft','published','cancelled')
  unique (edition_id, number)

riders
  id                 uuid pk
  edition_id         uuid fk
  pcs_slug           text
  name, team, bib    text / int
  status             enum('active','dnf','dns') default 'active'
  unique (edition_id, pcs_slug)

stage_picks
  id                 uuid pk
  user_id            uuid fk profiles
  stage_id           uuid fk stages
  rider_id           uuid fk riders
  created_at, updated_at
  unique (user_id, stage_id)

gc_picks
  user_id            uuid fk profiles
  edition_id         uuid fk
  position           int check (position between 1 and 3)
  rider_id           uuid fk riders
  pk (user_id, edition_id, position)

points_jersey_picks
  user_id            uuid fk profiles
  edition_id         uuid fk
  rider_id           uuid fk riders
  pk (user_id, edition_id)

stage_results
  stage_id           uuid fk
  position           int check (position between 1 and 10)
  rider_id           uuid fk riders
  status             enum('draft','published')
  updated_at         timestamptz
  pk (stage_id, position)

final_classifications
  edition_id         uuid fk
  kind               enum('gc','points_jersey')
  position           int                  -- 1..3 for gc, 1 for points_jersey
  rider_id           uuid fk riders
  status             enum('draft','published')
  updated_at         timestamptz
  pk (edition_id, kind, position)

invites
  code               text pk
  created_by         uuid fk profiles
  email              text
  used_at            timestamptz
  expires_at         timestamptz

audit_log
  id                 uuid pk
  actor_id           uuid fk profiles
  action             text        -- 'publish_stage', 'edit_result', 'cancel_stage', etc.
  target             jsonb
  created_at         timestamptz default now()

scrape_errors
  id                 uuid pk
  run_at             timestamptz default now()
  target             text        -- url or 'startlist' / 'stage-7-results'
  error              text
  html_snippet       text

pick_reminders_sent
  user_id            uuid fk profiles
  stage_id           uuid fk stages
  sent_at            timestamptz default now()
  pk (user_id, stage_id)
```

### 3.1 Leaderboard (computed)

Regular SQL view (not materialized — 34 users, no perf concern):

```
leaderboard_view
  user_id, display_name,
  stage_points           int,
  gc_points              int,
  jersey_points          int,
  total_points           int,
  exact_winners_count    int
```

### 3.2 No-reuse constraint

Enforced in the `submitPick` server action, not by a DB unique index. Rationale: a cancelled stage must not permanently burn a rider. The action checks:

```
SELECT 1 FROM stage_picks sp
JOIN stages s ON s.id = sp.stage_id
WHERE sp.user_id = $1
  AND sp.rider_id = $2
  AND s.id != $3
  AND s.status != 'cancelled'
```

If a row is returned, reject with "Rider already used on stage N."

### 3.3 RLS policy summary

| Table | Read | Write |
|---|---|---|
| profiles | all authenticated | self (display_name), admins (role) |
| editions, stages, riders | all authenticated | admins |
| stage_picks | self any time; all users after `stages.start_time` | self before lock |
| gc_picks, points_jersey_picks | self any time; all users after Stage 1 locks | self before Stage 1 locks |
| stage_results (published) | all authenticated | admins |
| stage_results (draft) | admins | admins (via scraper + manual edits) |
| final_classifications | same as stage_results | admins |
| invites | admins | admins |
| audit_log, scrape_errors | admins | server actions + cron (service role) |

## 4. User and admin flows

### 4.1 Invite → sign-up

1. Admin enters player email in `/admin/invites` → row inserted in `invites` with a short code and 7-day expiry.
2. Supabase sends magic link: `https://<host>/auth/callback?code=...&invite=<code>`.
3. User clicks, Supabase verifies, app reads `invite` param and links it to the new `auth.users` id.
4. First-time onboarding page collects display name → creates `profiles` row.
5. Subsequent sign-ins use the same email; no invite needed.

### 4.2 Pre-race picks (GC + jersey)

User lands on `/picks`. Three sections:

- **Stage picks** (collapsed list of counted stages)
- **GC top 3** — three ordered slots, rider picker per slot
- **Points jersey** — one rider picker

GC and jersey lock when Stage 1's `start_time` passes. Until then, fully editable.

### 4.3 Stage pick

1. User taps a stage → rider picker (search by name / team / bib).
2. Riders already used on another counted stage are shown greyed out with "Already picked — Stage N." DNF'd or DNS'd riders are disabled with a tag.
3. User confirms → server action validates (stage status ≠ `locked`/`published`/`cancelled`, rider active, no-reuse check) → upserts `stage_picks`.
4. Editable until `stages.start_time`.

### 4.4 Scrape → admin publish

1. Vercel Cron hits `/api/cron/scrape-pcs` every 15 min during race window.
2. Scraper fetches: (a) any stage whose `start_time` is in the last 6 hours and whose `status != 'published'`, (b) final classifications if `now() > edition.end_date`.
3. Parses top 10; upserts `stage_results` rows with `status = 'draft'`. Same for `final_classifications`.
4. Emails admins: "Stage N draft results ready."
5. Admin opens `/admin/stages/N`, sees the scraped top 10 + a computed score preview per user, edits if needed, clicks **Publish**.
6. Server action flips `status='published'`, writes `audit_log` row. Leaderboard recomputes (view is live).
7. Post-publish, players can see each other's picks for that stage.

### 4.5 Rider DNF

No special handling. The user's pick remains as-is; the rider stays picked. If the rider doesn't finish the stage in the top 10, the user scores 0. The no-reuse constraint still considers the rider "used" (their pick of record includes it). Users can edit the pick via normal rules (before stage lock); the app does not prompt them to change.

### 4.6 Stage cancelled

Admin sets `stages.status = 'cancelled'` in `/admin`. Any stage_picks for that stage score 0. The no-reuse check skips cancelled stages, so the rider stays available for future picks.

### 4.7 Pick reminder

Hourly cron (`/api/cron/send-reminders`) during the race window. For each stage locking within the next ~2 hours, email users who have no `stage_picks` row yet. Idempotent via a dedicated `pick_reminders_sent` table with PK `(user_id, stage_id)`; the cron inserts rows at send time and skips users that already have a row.

### 4.8 Final classifications

Same as 4.4, with `kind = 'gc'` (three rows) or `kind = 'points_jersey'` (one row).

## 5. Scoring engine

One pure function per user per scoring unit. Idempotent. Called on publish.

### 5.1 Stage points

```
function stagePoints(userPick, stage, results):
  if stage.status != 'published': return 0
  pos = results.find(r => r.rider_id == userPick.rider_id)?.position
  base = [25,15,10,8,6,5,4,3,2,1][pos-1] if pos in 1..10 else 0
  return stage.double_points ? base * 2 : base
```

### 5.2 GC points

```
function gcPoints(userPicks[3], finalGC[3]):
  total = 0
  actualSet = { finalGC[0].rider, finalGC[1].rider, finalGC[2].rider }
  for i in 0..2:
    if userPicks[i].rider == finalGC[i].rider: total += 30
    elif userPicks[i].rider in actualSet: total += 10
  return total
```

### 5.3 Points jersey

```
function jerseyPoints(userPick, finalJerseyWinner):
  return userPick.rider == finalJerseyWinner ? 30 : 0
```

### 5.4 Totals and tiebreaker

- `total_points = sum(stage_points) + gc_points + jersey_points`
- `exact_winners_count = count of stages where user's rider is position 1 in published results`
- Ordering: `ORDER BY total_points DESC, exact_winners_count DESC`. Beyond that, users share the rank.

## 6. Mobile UX

### 6.1 Layout

Mobile-first, 360px+ viewport. Bottom tab bar:

- **Home** — next stage countdown + current pick + top-5 leaderboard preview.
- **Picks** — list of counted stages with status pill (Open / Pick / Locked / Scored), plus GC and Jersey entry cards.
- **Board** — full leaderboard with columns: rank, name, total, stage pts, GC pts, jersey pts, exact winners.
- **Me** — profile, my picks recap, sign out.

### 6.2 Admin

Separate route `/admin` gated by `profiles.role = 'admin'`:

- Edition setup: toggle `counts_for_scoring` and `double_points` per stage.
- Startlist review: scraped draft → confirm → riders become live for pickers.
- Stage result review: draft → edit → publish.
- Final classifications: same flow as stage results.
- Invite generator: enter email, generate, copy/send link.
- Player roster: list, promote/demote admin, soft-delete.

### 6.3 PWA

- Manifest + icon set.
- Service worker caches static assets; no offline picks (must be authenticated + server-validated).

## 7. Error handling and edge cases

| Scenario | Handling |
|---|---|
| PCS 5xx / timeout | Retry next tick. After 3 consecutive failures, email admins. |
| HTML parse error | Log to `scrape_errors` with snippet; email admins; never write partial draft. |
| Wrong scraped data | Admin edits top 10 inline in draft before publishing. |
| Concurrent pick at lock moment | Server action re-reads `stages.start_time` in a transaction with `FOR UPDATE`. Reject if locked. |
| Concurrent admin publish | Optimistic concurrency via `updated_at`; second admin sees "results changed, reload." |
| Stage cancelled after publish | Admin flips `status='cancelled'`; view recomputes; rider no longer consumed. |
| Admin edits published results | Allowed. Logged to `audit_log`. Leaderboard recomputes. |
| Invite expired | 7-day TTL → "Ask admin for a fresh invite." |
| Single-use invite reused | `used_at` check; second click errors. |
| All timestamps | UTC in DB. UI uses browser `Intl.DateTimeFormat` + relative countdowns. |
| Deleted user | Soft-delete via `deleted_at`. Picks retained so history stays intact. |
| Scraping etiquette | Cron only during edition window. Backoff on 429/503. One stage page per tick. Identifying User-Agent. |

## 8. Testing strategy

### 8.1 Unit (Vitest)

- **Scoring engine** — every branch: top-10 lookup, double points, cancelled → 0, GC exact / in-podium / miss, jersey hit / miss, tiebreaker counting.
- **No-reuse validator** — cancelled stages are skipped (rider still available); picks on non-cancelled stages block reuse; a DNF'd rider already picked still counts as used (per §4.5).
- **PCS parsers** — checked-in HTML fixtures → expected shape. A schema change in PCS breaks the test before it reaches prod.

### 8.2 Integration (Vitest + local Supabase)

- Full flows: invite → signup → first pick → scrape → publish → score.
- RLS denials: user reads someone else's un-locked pick → denied. Non-admin calls `publishResults` → denied.
- Seed: 3 users, 1 admin, 1 edition with 3 stages (1 cancelled, 1 with double points).

### 8.3 E2E (Playwright, smoke)

- One mobile viewport test: sign in → pick a rider → reload → pick persists.
- One admin test: publish a stage with stubbed data → leaderboard shows expected points.

### 8.4 Operational readiness

- Pre-race: run scraper against prior-year stage HTML, verify output matches fixture.
- During race: `/admin` shows "Last successful scrape: Xm ago" indicator. Red after 30 min.
- CI: GitHub Actions runs typecheck, lint, unit, integration on every PR.

## 9. Defaults baked in (call out any to change)

- **Invites:** admin-generated magic-link emails, 7-day expiry, single-use.
- **Reminders:** email 2 h before each stage lock to users with no pick.
- **Visibility:** picks hidden until stage lock, then visible to all authenticated users.
- **Scrape cadence:** every 15 min during the edition's window only.
- **Language:** English.
- **Timezone:** UTC storage, browser-local display.

## 10. Out of scope for v1

- Multiple concurrent editions.
- Public/open signup.
- Native apps.
- Push notifications (email only for now).
- Social feed / chat.
- Monetization.

## 11. Open questions

- Exact Giro 2026 calendar (dates, stage types). Admin enters during setup; no code impact.
- Preferred email sender identity / transactional email provider beyond Supabase SMTP (Resend is a common swap if Supabase SMTP limits bite).
- Whether PWA should include an install prompt or rely on browser UI.
