import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { assignRanks, type LeaderboardRow, type RankedLeaderboardRow } from '@/lib/scoring';

export async function getLeaderboard(): Promise<RankedLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leaderboard_view')
    .select('*')
    .order('total_points', { ascending: false })
    .order('exact_winners_count', { ascending: false });
  if (error) throw error;

  // The view is typed all-nullable by supabase codegen; filter + coerce.
  const rows: LeaderboardRow[] = (data ?? [])
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

  return assignRanks(rows);
}
