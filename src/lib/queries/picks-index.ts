import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getActiveEdition } from '@/lib/queries/stages';

export async function getPicksIndex(userId: string) {
  const edition = await getActiveEdition();
  if (!edition) return null;

  const supabase = await createClient();

  const [
    { data: stages },
    { data: picks },
    { data: results },
    { data: gcPicks },
    { data: jerseyPicksRaw },
  ] = await Promise.all([
    supabase
      .from('stages')
      .select('id, number, start_time, counts_for_scoring, double_points, status, terrain, km')
      .eq('edition_id', edition.id)
      .order('number', { ascending: true }),
    supabase
      .from('stage_picks')
      .select('stage_id, rider_id, underdog_rider_id, stages!inner(number, status, double_points), riders!inner(id, name, team, bib, status), underdog_rider:riders!stage_picks_underdog_rider_id_fkey(id, name, team, bib, status)')
      .eq('user_id', userId),
    supabase
      .from('stage_results')
      .select('stage_id, position, rider_id')
      .eq('status', 'published'),
    supabase
      .from('gc_picks')
      .select('position, rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', userId)
      .eq('edition_id', edition.id)
      .order('position'),
    supabase
      .from('jersey_picks')
      .select('kind, rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', userId)
      .eq('edition_id', edition.id),
  ]);

  return {
    edition,
    stages: stages ?? [],
    picks: picks ?? [],
    results: results ?? [],
    gcPicks: gcPicks ?? [],
    jerseyPicks: (jerseyPicksRaw ?? []) as Array<{
      kind: 'points' | 'white';
      rider_id: string;
      riders: { id: string; name: string; team: string | null; bib: number | null };
    }>,
  };
}
