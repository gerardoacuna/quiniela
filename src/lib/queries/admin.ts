import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getAdminCounts(editionId: string) {
  const supabase = await createClient();
  const [players, countedStages, pendingInvites] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('stages').select('id', { count: 'exact', head: true }).eq('edition_id', editionId).eq('counts_for_scoring', true),
    supabase.from('invites').select('code', { count: 'exact', head: true }).is('used_at', null),
  ]);
  return {
    players: players.count ?? 0,
    countedStages: countedStages.count ?? 0,
    pendingInvites: pendingInvites.count ?? 0,
  };
}

export async function getCronRuns() {
  const supabase = await createClient();
  const { data } = await supabase.from('cron_runs').select('*');
  return data ?? [];
}

export async function listScrapeErrors(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('scrape_errors').select('*').order('run_at', { ascending: false }).limit(limit);
  return data ?? [];
}

export async function listAuditEvents(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  return data ?? [];
}
