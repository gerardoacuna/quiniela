import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getActiveEdition } from '@/lib/queries/stages';
import { assignRanks } from '@/lib/scoring';
import type { LeaderboardRow } from '@/lib/scoring';

export interface MeStagePick {
  stage_id: string;
  rider_id: string;
  underdog_rider_id: string | null;
  stages: {
    number: number;
    double_points: boolean;
    status: string;
    start_time: string;
    km: number;
    terrain: string;
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
}

export interface MeGcPick {
  position: number;
  rider_id: string;
  riders: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
    status: string;
  };
}

export interface MeJerseyPick {
  kind: 'points' | 'white';
  rider_id: string;
  riders: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
    status: string;
  };
}

export interface MeResult {
  stage_id: string;
  position: number;
  rider_id: string;
}

export interface MeData {
  edition: { id: string; name: string };
  profile: { display_name: string; email: string | null };
  rank: number | null;
  board: LeaderboardRow & { rank: number } | null;
  stagePicks: MeStagePick[];
  gcPicks: MeGcPick[];
  jerseyPicks: MeJerseyPick[];
  results: MeResult[];
  totalPlayers: number;
  countedStagesTotal: number;
}

export async function getMeData(userId: string): Promise<MeData | null> {
  const edition = await getActiveEdition();
  if (!edition) return null;

  const supabase = await createClient();

  const [
    { data: profileRaw },
    { data: boardRaw },
    { data: stagePicksRaw },
    { data: gcPicksRaw },
    { data: jerseyRaw },
    { data: resultsRaw },
    { data: allBoardRaw },
    { count: countedStagesTotal },
  ] = await Promise.all([
    supabase.from('profiles').select('display_name, email').eq('id', userId).single(),
    supabase
      .from('leaderboard_view')
      .select('*')
      .eq('edition_id', edition.id)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('stage_picks')
      .select('stage_id, rider_id, underdog_rider_id, stages!inner(number, double_points, status, start_time, km, terrain), riders!inner(id, name, team, bib, status), underdog_rider:riders!stage_picks_underdog_rider_id_fkey(id, name, team, bib, status)')
      .eq('user_id', userId),
    supabase
      .from('gc_picks')
      .select('position, rider_id, riders!inner(id, name, team, bib, status)')
      .eq('user_id', userId)
      .eq('edition_id', edition.id)
      .order('position'),
    supabase
      .from('jersey_picks')
      .select('kind, rider_id, riders!inner(id, name, team, bib, status)')
      .eq('user_id', userId)
      .eq('edition_id', edition.id),
    supabase
      .from('stage_results')
      .select('stage_id, position, rider_id')
      .eq('status', 'published'),
    supabase
      .from('leaderboard_view')
      .select('user_id, total_points, exact_winners_count, display_name, edition_id, stage_points, gc_points, jersey_points')
      .eq('edition_id', edition.id),
    supabase
      .from('stages')
      .select('id', { count: 'exact', head: true })
      .eq('edition_id', edition.id)
      .eq('counts_for_scoring', true),
  ]);

  // Compute rank from full board
  const allBoardRows: LeaderboardRow[] = (allBoardRaw ?? [])
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

  const ranked = assignRanks(allBoardRows);
  const myRankedRow = ranked.find((r) => r.user_id === userId) ?? null;

  const profile = profileRaw ?? { display_name: 'You', email: null };

  // Coerce board row for this user
  const board = boardRaw
    ? {
        user_id: boardRaw.user_id as string,
        display_name: boardRaw.display_name as string,
        edition_id: boardRaw.edition_id as string,
        stage_points: boardRaw.stage_points ?? 0,
        gc_points: boardRaw.gc_points ?? 0,
        jersey_points: boardRaw.jersey_points ?? 0,
        total_points: boardRaw.total_points ?? 0,
        exact_winners_count: boardRaw.exact_winners_count ?? 0,
        rank: myRankedRow?.rank ?? 0,
      }
    : null;

  return {
    edition,
    profile,
    rank: myRankedRow?.rank ?? null,
    board,
    stagePicks: (stagePicksRaw ?? []) as unknown as MeStagePick[],
    gcPicks: (gcPicksRaw ?? []) as unknown as MeGcPick[],
    jerseyPicks: (jerseyRaw ?? []) as unknown as MeJerseyPick[],
    results: (resultsRaw ?? []) as MeResult[],
    totalPlayers: ranked.length,
    countedStagesTotal: countedStagesTotal ?? 0,
  };
}
