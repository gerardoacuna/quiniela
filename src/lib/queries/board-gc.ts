import 'server-only';
import { createClient } from '@/lib/supabase/server';

// ---- Types ---------------------------------------------------------------

export interface GcRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
}

/** Raw row shape returned by the gc_picks SELECT below. Exported for tests. */
export interface GcRawRow {
  user_id: string;
  position: 1 | 2 | 3;
  profiles: { display_name: string };
  riders: GcRider;
}

export interface BoardGcByPlayerRow {
  userId: string;
  displayName: string;
  picks: {
    p1: GcRider | null;
    p2: GcRider | null;
    p3: GcRider | null;
  };
}

export interface BoardGcByRiderRow {
  rider: GcRider;
  p1Names: string[];
  p2Names: string[];
  p3Names: string[];
}

export interface BoardGcData {
  isLocked: boolean;
  submissionCount: number;
  byPlayer: BoardGcByPlayerRow[];
  byRider: BoardGcByRiderRow[];
}

// ---- Pure transforms (tested) -------------------------------------------

/**
 * Pivot raw (user, position) rows into one row per user with the three slots
 * filled. Output is ordered by `playerOrder`. Players in `playerOrder` with no
 * matching rows render with all three slots null. Players present in `rows`
 * but absent from `playerOrder` are dropped (defensive — not expected since
 * the leaderboard view is the union of all participants).
 */
export function buildGcByPlayer(
  rows: GcRawRow[],
  playerOrder: string[],
): BoardGcByPlayerRow[] {
  const byUser = new Map<string, BoardGcByPlayerRow>();
  for (const r of rows) {
    let entry = byUser.get(r.user_id);
    if (!entry) {
      entry = {
        userId: r.user_id,
        displayName: r.profiles.display_name,
        picks: { p1: null, p2: null, p3: null },
      };
      byUser.set(r.user_id, entry);
    }
    if (r.position === 1) entry.picks.p1 = r.riders;
    else if (r.position === 2) entry.picks.p2 = r.riders;
    else if (r.position === 3) entry.picks.p3 = r.riders;
  }
  return playerOrder.map(
    (userId) =>
      byUser.get(userId) ?? {
        userId,
        displayName: '',
        picks: { p1: null, p2: null, p3: null },
      },
  );
}

export function buildGcByRider(
  _rows: GcRawRow[],
  _currentUserId: string,
): BoardGcByRiderRow[] {
  // Implemented in Task 3.
  return [];
}

// ---- I/O wrapper ---------------------------------------------------------

export async function getBoardGcData(
  _editionId: string,
  _currentUserId: string,
): Promise<BoardGcData> {
  // Implemented in Task 4.
  await createClient();
  throw new Error('not implemented');
}
