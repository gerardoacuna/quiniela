import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { assignRanks } from '@/lib/scoring';
import type { LeaderboardRow } from '@/lib/scoring';
import { BoardClient } from './client';

export default async function BoardPage() {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const supabase = await createClient();
  const { data: rawRows } = await supabase
    .from('leaderboard_view')
    .select('*')
    .eq('edition_id', edition.id);

  // Coerce nullable Supabase types — filter out rows missing required fields
  const rows: LeaderboardRow[] = (rawRows ?? [])
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

  const ranked = assignRanks(rows);

  return <BoardClient rows={ranked} currentUserId={user.id} />;
}
