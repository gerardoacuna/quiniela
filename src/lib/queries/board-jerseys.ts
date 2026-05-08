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
  _rows: JerseyRawRow[],
  _currentUserId: string,
): BoardJerseysByRiderGrouped {
  // Implemented in Task 6.
  return { points: [], white: [] };
}

// ---- I/O wrapper ---------------------------------------------------------

export async function getBoardJerseysData(
  _editionId: string,
): Promise<BoardJerseysData> {
  // Implemented in Task 7.
  await createClient();
  throw new Error('not implemented');
}
