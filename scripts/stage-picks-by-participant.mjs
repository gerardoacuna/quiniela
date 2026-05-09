// Read-only: list stage picks by participant for a given stage number of the
// active edition, joined with results to compute primary + underdog points.
//
// Usage:
//   node --env-file=.env.production scripts/stage-picks-by-participant.mjs 2
//   node --env-file=.env.local      scripts/stage-picks-by-participant.mjs 2

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const stageNumber = Number(process.argv[2] ?? 2);
if (!Number.isInteger(stageNumber)) {
  console.error('Usage: node scripts/stage-picks-by-participant.mjs <stageNumber>');
  process.exit(1);
}

const STAGE_POINT_TABLE = [25, 20, 16, 13, 11, 9, 7, 5, 3, 2];
function pointsForFinish(position, doublePoints) {
  if (position == null || position < 1 || position > 10) return 0;
  const base = STAGE_POINT_TABLE[position - 1];
  return doublePoints ? base * 2 : base;
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: editions, error: edErr } = await sb
  .from('editions')
  .select('id, name, is_active')
  .eq('is_active', true)
  .limit(1);
if (edErr) throw edErr;
if (!editions?.length) {
  console.error('No active edition found');
  process.exit(1);
}
const edition = editions[0];

const { data: stage, error: sErr } = await sb
  .from('stages')
  .select('id, number, status, double_points, start_time')
  .eq('edition_id', edition.id)
  .eq('number', stageNumber)
  .maybeSingle();
if (sErr) throw sErr;
if (!stage) {
  console.error(`No stage ${stageNumber} in edition ${edition.name}`);
  process.exit(1);
}

const [{ data: profiles, error: pErr }, { data: picks, error: pkErr }, { data: results, error: rErr }] = await Promise.all([
  sb.from('profiles').select('id, display_name').is('deleted_at', null),
  sb
    .from('stage_picks')
    .select(
      'user_id, ' +
        'primary_rider:riders!stage_picks_rider_id_fkey(id, name), ' +
        'underdog_rider:riders!stage_picks_underdog_rider_id_fkey(id, name)',
    )
    .eq('stage_id', stage.id),
  sb
    .from('stage_results')
    .select('rider_id, position, status')
    .eq('stage_id', stage.id)
    .eq('status', 'published'),
]);
if (pErr) throw pErr;
if (pkErr) throw pkErr;
if (rErr) throw rErr;

const resultsMap = new Map((results ?? []).map((r) => [r.rider_id, r.position]));
const pickByUser = new Map();
for (const row of picks ?? []) {
  pickByUser.set(row.user_id, {
    primary: row.primary_rider ?? null,
    underdog: row.underdog_rider ?? null,
  });
}

const rows = (profiles ?? []).map((p) => {
  const slot = pickByUser.get(p.id) ?? { primary: null, underdog: null };
  const primaryPos = slot.primary ? resultsMap.get(slot.primary.id) ?? null : null;
  const underdogPos = slot.underdog ? resultsMap.get(slot.underdog.id) ?? null : null;
  return {
    name: p.display_name,
    underdog: slot.underdog?.name ?? '',
    underdogPos,
    underdogPts: pointsForFinish(underdogPos, stage.double_points),
    primary: slot.primary?.name ?? '',
    primaryPos,
    primaryPts: pointsForFinish(primaryPos, stage.double_points),
  };
});

rows.sort((a, b) => {
  const total = (b.primaryPts + b.underdogPts) - (a.primaryPts + a.underdogPts);
  if (total !== 0) return total;
  return a.name.localeCompare(b.name);
});

const dp = stage.double_points ? ' (2× double points)' : '';
const scoredNote = results?.length ? '' : ' — results not published yet';
console.log(`Stage ${stage.number} · ${edition.name}${dp}${scoredNote}\n`);

const W = { name: 22, ud: 22, udp: 7, pri: 22, prip: 7 };
const pad = (s, w) => (s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w));
const padR = (s, w) => (s.length > w ? s.slice(0, w - 1) + '…' : s.padStart(w));

console.log(
  pad('Participant', W.name) + '  ' +
  pad('Underdog', W.ud) + '  ' +
  padR('UD pts', W.udp) + '  ' +
  pad('Primary', W.pri) + '  ' +
  padR('Pri pts', W.prip),
);
console.log('-'.repeat(W.name + W.ud + W.udp + W.pri + W.prip + 8));
for (const r of rows) {
  console.log(
    pad(r.name ?? '', W.name) + '  ' +
    pad(r.underdog || '—', W.ud) + '  ' +
    padR(r.underdogPos != null ? String(r.underdogPts) : '—', W.udp) + '  ' +
    pad(r.primary || '— no pick', W.pri) + '  ' +
    padR(r.primaryPos != null ? String(r.primaryPts) : '—', W.prip),
  );
}
console.log(`\n${rows.length} participants.`);
