# Design: Tour de France 2026 setup

**Date:** 2026-07-01
**Status:** Approved (design)

## Goal

Stand up the Tour de France 2026 as a new race edition, populated entirely from
operator-provided data (no PCS scraping), packaged as committed, idempotent SQL
migrations following the Giro 2026 precedent. The edition loads **dormant**
(`is_active = false`) and is switched live by a separate, deliberate activation
step at go-live.

## Context & constraints

- The app is **single-active-edition**: a unique index
  (`editions_single_active_idx`) allows only one row with `is_active = true`.
  Giro and Tour therefore cannot both be active; activation is a swap.
- The app renders "the active edition" everywhere via `getActiveEdition()` and
  `leaderboard_view` (filtered on `e.is_active`). Once the Tour is populated and
  activated, the app works with no application-code changes.
- **No data ingestion.** The PCS scraper is intentionally not used (too fragile)
  and not extended. Its fate is deferred (left dormant for now).
- **No reusable admin UI** in this project. Creating editions/stages and
  switching the active edition remain migration/SQL-driven, as they were for the
  Giro.
- GC Top-5 (positions 1–5) is already supported by the schema/scoring from prior
  work — the Tour inherits it automatically, no extra work.
- Relevant required columns: `riders.pcs_slug` is `NOT NULL` and unique per
  edition; `stages.start_time` is `NOT NULL`; `stages.counts_for_scoring` and
  `stages.double_points` default `false` (set explicitly). `stages.terrain` and
  `stages.km` come from the `20260420000001` migration.

## Why unconditional insert (vs the Giro's guard)

The Giro startlist migration was guarded to no-op locally because it targeted a
**prod-only** edition UUID absent from the local seed. For the Tour we choose the
edition UUID ourselves and insert it **unconditionally**, so the Tour data exists
in **both** local dev and prod. It is inserted `is_active = false` so it does not
collide with the locally-seeded active Giro under the single-active index.

## Migration breakdown

All migrations are idempotent and safe to re-run. Timestamps follow the existing
convention (e.g. `20260701000001_…`). The Tour edition uses a single fixed UUID
(chosen at implementation time) referenced by all Tour migrations.

### Migration 1 — edition + 21 stages (`…_tour_2026_edition_stages.sql`)

- Insert the Tour edition: fixed UUID, `slug = 'tour-de-france-2026'`,
  `name = 'Tour de France 2026'`, `start_date`/`end_date` from the operator
  schedule, `is_active = false`. `on conflict (id) do update` for re-runs.
- Insert 21 stages for that edition. Per stage: `number` (1–21), `start_time`
  (operator-provided local time, stored as UTC `timestamptz`), `terrain`
  (`flat`/`hilly`/`mountain`/`itt`), `km`, `counts_for_scoring = true`,
  `double_points` per operator (default `false`). `on conflict (edition_id,
  number) do update` for re-runs.

### Migration 2 — startlist + flags (`…_tour_2026_startlist.sql`)

- Upsert the ~176 riders for the Tour edition: `name`, `team`, `bib`, and a
  `pcs_slug` generated deterministically from the name (slugified, uniqueness
  enforced; disambiguated with a numeric suffix if two riders slugify equal, as
  the Giro data did, e.g. `filippo-magli2`). `status = 'active'`,
  `is_top_tier = false` by default. `on conflict (edition_id, pcs_slug) do
  update set name/team/bib/status` for re-runs.
- Set `is_top_tier = true` for the operator-named favorites (by slug).

### Activation — separate go-live step (`…_tour_2026_activate.sql`, applied later)

- A single transaction: `update editions set is_active = false where
  slug = 'giro-2026'; update editions set is_active = true where
  slug = 'tour-de-france-2026';` — order/transaction respects the single-active
  unique index.
- Delivered as a ready-to-apply migration (or equivalent SQL) that the operator
  runs **at go-live**, decoupled from loading the data, so the data can be loaded
  ahead of time without switching the app over prematurely.
- Existing Giro players keep their accounts and see the Tour automatically once
  active (invites/accounts are global, not edition-scoped). No re-invite needed.

### Optional — bulk invites (`…_tour_2026_bulk_invites.sql`)

- Only if the operator supplies emails for **new** participants not already in
  the system. Mirrors the Giro `20260505000008` pattern: insert into `invites`
  (`code`, `created_by = null`, `email`, `expires_at`) with a
  `where not exists (select 1 from profiles where email = …)` guard. Omitted if
  no new participants.

## Prod safety

- Migrations are applied to prod via `supabase db push` (not `db reset`).
- Data loads while `is_active = false`; the app does not change behavior until
  the operator applies the activation step.
- All migrations idempotent → re-running is safe.
- The db-reset blocker fix (guard on `20260505000006`) means local
  `supabase db reset` succeeds, so the full chain — including the Tour data — is
  verifiable locally before anything is pushed.

## Testing / verification

- Local `supabase db reset` completes green with the Tour loaded and **dormant**
  (Giro remains the single active edition locally).
- Assertions (integration or a verification query): the Tour edition exists with
  `is_active = false`; exactly 21 stages for it; the full startlist count matches
  the operator data; `is_top_tier` count matches the favorites list; the
  double-points stage(s) flagged correctly.
- Activation swap: after applying the activation step locally, exactly one
  edition is active (the Tour) and `getActiveEdition()` returns it; the
  single-active index is never violated.
- `npm run typecheck` and existing unit/integration suites stay green (57/57).

## Operator-provided data (inputs to implementation)

Implementation is blocked on these inputs; format is flexible (paste/CSV/file):

1. **Edition:** exact `start_date` and `end_date` (name/slug default to
   "Tour de France 2026" / `tour-de-france-2026`).
2. **21 stages:** per stage — date + start time (with timezone), `terrain`
   (`flat`/`hilly`/`mountain`/`itt`), `km`; and which stage(s) are double points.
3. **Startlist:** riders as `name, team, bib` (~176). Slugs optional (generated
   if absent).
4. **Top-tier favorites:** list of rider names to flag `is_top_tier`.
5. **New invites:** emails of participants not already in the Giro, or "none".

## Out of scope (YAGNI / deferred)

- PCS scraping and any edition-aware ingestion work (dropped).
- Reusable admin UI to create editions, edit stage schedules, or switch the
  active edition (deferred — remains SQL/migration-driven).
- A viewable archive of past (deactivated) editions — the app stays active-only;
  the Giro's standings become hidden once the Tour is active (still in the DB,
  re-activatable).
- Removing/refactoring the existing PCS scraper (decision deferred).
