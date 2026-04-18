import { describe, it, expect } from 'vitest';
import { assignRanks, type LeaderboardRow } from './leaderboard';

function row(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    user_id: 'u',
    display_name: 'User',
    edition_id: 'e',
    stage_points: 0,
    gc_points: 0,
    jersey_points: 0,
    total_points: 0,
    exact_winners_count: 0,
    ...overrides,
  };
}

describe('assignRanks', () => {
  it('sorts by total_points desc', () => {
    const rows = [
      row({ user_id: 'a', total_points: 50 }),
      row({ user_id: 'b', total_points: 90 }),
      row({ user_id: 'c', total_points: 70 }),
    ];
    const ranked = assignRanks(rows);
    expect(ranked.map(r => r.user_id)).toEqual(['b', 'c', 'a']);
    expect(ranked.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks ties with exact_winners_count desc', () => {
    const rows = [
      row({ user_id: 'a', total_points: 80, exact_winners_count: 1 }),
      row({ user_id: 'b', total_points: 80, exact_winners_count: 3 }),
      row({ user_id: 'c', total_points: 80, exact_winners_count: 2 }),
    ];
    const ranked = assignRanks(rows);
    expect(ranked.map(r => r.user_id)).toEqual(['b', 'c', 'a']);
    expect(ranked.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it('shares rank when total and tiebreaker both tie', () => {
    const rows = [
      row({ user_id: 'a', total_points: 80, exact_winners_count: 2 }),
      row({ user_id: 'b', total_points: 80, exact_winners_count: 2 }),
      row({ user_id: 'c', total_points: 70, exact_winners_count: 5 }),
    ];
    const ranked = assignRanks(rows);
    expect(ranked.map(r => r.rank)).toEqual([1, 1, 3]);
  });

  it('empty input returns empty array', () => {
    expect(assignRanks([])).toEqual([]);
  });
});
