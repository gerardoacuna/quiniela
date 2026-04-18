export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  edition_id: string;
  stage_points: number;
  gc_points: number;
  jersey_points: number;
  total_points: number;
  exact_winners_count: number;
}

export interface RankedLeaderboardRow extends LeaderboardRow {
  rank: number;
}

export function assignRanks(rows: readonly LeaderboardRow[]): RankedLeaderboardRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.total_points !== b.total_points) return b.total_points - a.total_points;
    if (a.exact_winners_count !== b.exact_winners_count) {
      return b.exact_winners_count - a.exact_winners_count;
    }
    return 0;
  });

  const ranked: RankedLeaderboardRow[] = [];
  let currentRank = 0;
  let lastKey = '';
  sorted.forEach((r, idx) => {
    const key = `${r.total_points}:${r.exact_winners_count}`;
    if (key !== lastKey) {
      currentRank = idx + 1;
      lastKey = key;
    }
    ranked.push({ ...r, rank: currentRank });
  });
  return ranked;
}
