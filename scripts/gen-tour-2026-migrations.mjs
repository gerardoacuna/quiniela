// One-time generator: emits the Tour de France 2026 data migrations from the
// committed startlist JSON. Deterministic; re-run to regenerate. Not used at runtime.
import { readFileSync, writeFileSync } from 'node:fs';

const ED = '11111111-1111-4111-8111-111111111111';
const esc = (s) => s.replace(/'/g, "''");

// [number, start_time (UTC), terrain, km(decimal), counts_for_scoring, double_points]
// Official ASO route + iCal start times; flags from the operator lists.
const STAGES = [
  [1, '2026-07-04 15:05:00+00', 'itt', 19.6, false, false],
  [2, '2026-07-05 11:55:00+00', 'hilly', 168.5, false, false],
  [3, '2026-07-06 10:20:00+00', 'mountain', 195.9, true, false],
  [4, '2026-07-07 11:25:00+00', 'hilly', 181.9, false, false],
  [5, '2026-07-08 12:15:00+00', 'flat', 158.3, false, false],
  [6, '2026-07-09 10:40:00+00', 'mountain', 186.2, true, false],
  [7, '2026-07-10 11:25:00+00', 'flat', 175.1, true, false],
  [8, '2026-07-11 11:25:00+00', 'flat', 180.4, false, false],
  [9, '2026-07-12 11:45:00+00', 'hilly', 185.5, true, true],
  [10, '2026-07-14 11:25:00+00', 'mountain', 166.6, true, false],
  [11, '2026-07-15 12:05:00+00', 'flat', 161.3, true, false],
  [12, '2026-07-16 12:40:00+00', 'flat', 179.1, false, false],
  [13, '2026-07-17 11:20:00+00', 'hilly', 205.8, true, true],
  [14, '2026-07-18 11:30:00+00', 'mountain', 155.3, true, false],
  [15, '2026-07-19 11:20:00+00', 'mountain', 183.9, true, true],
  [16, '2026-07-21 11:00:00+00', 'itt', 26.1, true, false],
  [17, '2026-07-22 11:35:00+00', 'flat', 174.7, false, false],
  [18, '2026-07-23 10:50:00+00', 'mountain', 185.2, true, true],
  [19, '2026-07-24 12:15:00+00', 'mountain', 127.9, true, true],
  [20, '2026-07-25 09:30:00+00', 'mountain', 170.9, true, true],
  [21, '2026-07-26 14:25:00+00', 'flat', 133.0, false, false],
];

const editionStagesSql = `-- Tour de France 2026: edition (dormant) + 21 stages. Generated; idempotent.
insert into public.editions (id, slug, name, start_date, end_date, is_active) values
  ('${ED}', 'tour-de-france-2026', 'Tour de France 2026', '2026-07-04', '2026-07-26', false)
on conflict (id) do update
  set slug = excluded.slug, name = excluded.name,
      start_date = excluded.start_date, end_date = excluded.end_date;
-- NOTE: is_active is intentionally NOT in the update set, so re-running never
-- flips activation. Activation is a separate ops step at go-live.

insert into public.stages (edition_id, number, start_time, counts_for_scoring, double_points, terrain, km) values
${STAGES.map(([n, t, ter, km, counts, dbl]) => `  ('${ED}', ${n}, '${t}', ${counts}, ${dbl}, '${ter}', ${Math.round(km)})`).join(',\n')}
on conflict (edition_id, number) do update
  set start_time = excluded.start_time, counts_for_scoring = excluded.counts_for_scoring,
      double_points = excluded.double_points, terrain = excluded.terrain, km = excluded.km;
`;

const riders = JSON.parse(readFileSync('scripts/data/tour-de-france-2026-startlist.json', 'utf8'));
const riderRows = riders
  .map((r) => `  ('${ED}', '${r.slug}', '${esc(r.name)}', '${esc(r.team)}', ${r.bib}, 'active', ${r.top})`)
  .join(',\n');
const startlistSql = `-- Tour de France 2026 startlist (${riders.length} riders). Generated from
-- scripts/data/tour-de-france-2026-startlist.json. Idempotent.
insert into public.riders (edition_id, pcs_slug, name, team, bib, status, is_top_tier) values
${riderRows}
on conflict (edition_id, pcs_slug) do update
  set name = excluded.name, team = excluded.team, bib = excluded.bib,
      status = excluded.status, is_top_tier = excluded.is_top_tier;
`;

writeFileSync('supabase/migrations/20260701000001_tour_2026_edition_stages.sql', editionStagesSql);
writeFileSync('supabase/migrations/20260701000002_tour_2026_startlist.sql', startlistSql);
console.log('wrote edition+21 stages and', riders.length, 'riders');
