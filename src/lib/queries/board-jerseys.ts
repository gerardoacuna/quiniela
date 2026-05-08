import 'server-only';
import { createClient } from '@/lib/supabase/server';

// ---- Types ---------------------------------------------------------------

export type JerseyKind = 'points' | 'white';

export interface JerseyRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
}

/** Raw row shape returned by the jersey_picks SELECT below. Exported for tests. */
export interface JerseyRawRow {
  user_id: string;
  kind: JerseyKind;
  profiles: { display_name: string };
  riders: JerseyRider;
}

export interface BoardJerseysByPlayerRow {
  userId: string;
  displayName: string;
  picks: {
    points: JerseyRider | null;
    white: JerseyRider | null;
  };
}

export interface BoardJerseysByRiderEntry {
  rider: JerseyRider;
  names: string[];
}

export interface BoardJerseysByRiderGrouped {
  points: BoardJerseysByRiderEntry[];
  white: BoardJerseysByRiderEntry[];
}

export interface BoardJerseysData {
  isLocked: boolean;
  submissionCount: number;
  rawRows: JerseyRawRow[];
}

// ---- Pure transforms (tested) -------------------------------------------

/**
 * Pivot raw (user, kind) rows into one row per user with the two slots
 * filled. Output is ordered by `playerOrder`. Players in `playerOrder` with no
 * matching rows render with both slots null. Players present in `rows`
 * but absent from `playerOrder` are dropped (defensive — not expected since
 * the leaderboard view is the union of all participants).
 */
export function buildJerseysByPlayer(
  rows: JerseyRawRow[],
  playerOrder: string[],
): BoardJerseysByPlayerRow[] {
  const byUser = new Map<string, BoardJerseysByPlayerRow>();
  for (const r of rows) {
    let entry = byUser.get(r.user_id);
    if (!entry) {
      entry = {
        userId: r.user_id,
        displayName: r.profiles.display_name,
        picks: { points: null, white: null },
      };
      byUser.set(r.user_id, entry);
    }
    if (r.kind === 'points') entry.picks.points = r.riders;
    else if (r.kind === 'white') entry.picks.white = r.riders;
  }
  return playerOrder.map(
    (userId) =>
      byUser.get(userId) ?? {
        userId,
        displayName: '',
        picks: { points: null, white: null },
      },
  );
}

export function buildJerseysByRider(
  rows: JerseyRawRow[],
  currentUserId: string,
): BoardJerseysByRiderGrouped {
  const collect = (kind: JerseyKind): BoardJerseysByRiderEntry[] => {
    const byRider = new Map<
      string,
      {
        rider: JerseyRider;
        pickers: Array<{ userId: string; displayName: string }>;
      }
    >();
    for (const r of rows) {
      if (r.kind !== kind) continue;
      let entry = byRider.get(r.riders.id);
      if (!entry) {
        entry = { rider: r.riders, pickers: [] };
        byRider.set(r.riders.id, entry);
      }
      entry.pickers.push({
        userId: r.user_id,
        displayName: r.profiles.display_name,
      });
    }

    const formatNames = (
      list: Array<{ userId: string; displayName: string }>,
    ): string[] => {
      // Sentinel sorts the current user first by userId match, not by display
      // string. This avoids conflating a user whose display_name is literally
      // 'You' with the actual viewer.
      const YOU = ' YOU';
      const labelled = list.map((p) =>
        p.userId === currentUserId ? YOU : p.displayName,
      );
      const sorted = labelled.sort((a, b) => {
        if (a === YOU) return -1;
        if (b === YOU) return 1;
        return a.localeCompare(b);
      });
      return sorted.map((s) => (s === YOU ? 'You' : s));
    };

    return Array.from(byRider.values())
      .map((e) => ({ rider: e.rider, names: formatNames(e.pickers) }))
      .sort((a, b) => {
        if (a.names.length !== b.names.length) return b.names.length - a.names.length;
        return a.rider.name.localeCompare(b.rider.name);
      });
  };

  return {
    points: collect('points'),
    white: collect('white'),
  };
}

// ---- I/O wrapper ---------------------------------------------------------

export async function getBoardJerseysData(
  _editionId: string,
): Promise<BoardJerseysData> {
  // Implemented in Task 7.
  await createClient();
  throw new Error('not implemented');
}
