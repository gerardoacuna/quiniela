import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getActiveEdition } from '@/lib/queries/stages';
import { assignRanks } from '@/lib/scoring';
import type { RankedLeaderboardRow } from '@/lib/scoring';

export type HomeStage = {
  id: string;
  number: number;
  start_time: string;
  counts_for_scoring: boolean;
  double_points: boolean;
  status: 'upcoming' | 'locked' | 'results_draft' | 'published' | 'cancelled';
  terrain: 'flat' | 'hilly' | 'mountain' | 'itt';
  km: number;
};

export type HomePick = {
  stage_id: string;
  rider_id: string;
  underdog_rider_id: string | null;
  stages: {
    number: number;
    status: string;
    double_points: boolean;
  };
  riders: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
    status: string;
  };
  underdog_rider: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
    status: string;
  } | null;
};

export type HomeResult = {
  stage_id: string;
  position: number;
  rider_id: string;
};

export type HomeData = {
  edition: { id: string; name: string; slug: string; start_date: string; end_date: string; is_active: boolean; created_at: string };
  stages: HomeStage[];
  picks: HomePick[];
  results: HomeResult[];
  board: RankedLeaderboardRow[];
};

export async function getHomeData(userId: string): Promise<HomeData | null> {
  const edition = await getActiveEdition();
  if (!edition) return null;

  const supabase = await createClient();

  const [{ data: stages }, { data: picksRaw }, { data: resultsRaw }, { data: boardRaw }] = await Promise.all([
    supabase
      .from('stages')
      .select('id, number, start_time, counts_for_scoring, double_points, status, terrain, km')
      .eq('edition_id', edition.id)
      .order('number', { ascending: true }),
    supabase
      .from('stage_picks')
      // Both joins MUST name the FK constraint — there are two FKs from
      // stage_picks to riders (rider_id, underdog_rider_id), so a bare
      // `riders!inner(...)` is ambiguous and Supabase returns null.
      .select('stage_id, rider_id, underdog_rider_id, stages!inner(number, status, double_points), riders!stage_picks_rider_id_fkey!inner(id, name, team, bib, status), underdog_rider:riders!stage_picks_underdog_rider_id_fkey(id, name, team, bib, status)')
      .eq('user_id', userId),
    supabase
      .from('stage_results')
      .select('stage_id, position, rider_id')
      .eq('status', 'published'),
    supabase
      .from('leaderboard_view')
      .select('*')
      .eq('edition_id', edition.id)
      .order('total_points', { ascending: false })
      .order('exact_winners_count', { ascending: false }),
  ]);

  // Coerce leaderboard rows, filtering nulls
  const boardRows = (boardRaw ?? [])
    .filter((r) => r.user_id != null && r.edition_id != null && r.display_name != null)
    .map((r) => ({
      user_id: r.user_id as string,
      display_name: r.display_name as string,
      edition_id: r.edition_id as string,
      stage_points: r.stage_points ?? 0,
      gc_points: r.gc_points ?? 0,
      jersey_points: r.jersey_points ?? 0,
      total_points: r.total_points ?? 0,
      exact_winners_count: r.exact_winners_count ?? 0,
    }));

  return {
    edition,
    stages: (stages ?? []) as HomeStage[],
    picks: (picksRaw ?? []) as unknown as HomePick[],
    results: (resultsRaw ?? []) as HomeResult[],
    board: assignRanks(boardRows),
  };
}
