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
  rows: GcRawRow[],
  currentUserId: string,
): BoardGcByRiderRow[] {
  // Map<rider_id, { rider, p1, p2, p3 }> where each p* is an array of { userId, displayName }.
  const byRider = new Map<
    string,
    {
      rider: GcRider;
      p1: Array<{ userId: string; displayName: string }>;
      p2: Array<{ userId: string; displayName: string }>;
      p3: Array<{ userId: string; displayName: string }>;
    }
  >();

  for (const r of rows) {
    let entry = byRider.get(r.riders.id);
    if (!entry) {
      entry = { rider: r.riders, p1: [], p2: [], p3: [] };
      byRider.set(r.riders.id, entry);
    }
    const slot =
      r.position === 1 ? entry.p1 : r.position === 2 ? entry.p2 : entry.p3;
    slot.push({ userId: r.user_id, displayName: r.profiles.display_name });
  }

  const formatNames = (
    list: Array<{ userId: string; displayName: string }>,
  ): string[] => {
    const YOU = ' YOU'; // sentinel; ' ' cannot appear in profiles.display_name
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
    .map((e) => ({
      rider: e.rider,
      p1Names: formatNames(e.p1),
      p2Names: formatNames(e.p2),
      p3Names: formatNames(e.p3),
    }))
    .sort((a, b) => {
      const totalA = a.p1Names.length + a.p2Names.length + a.p3Names.length;
      const totalB = b.p1Names.length + b.p2Names.length + b.p3Names.length;
      if (totalA !== totalB) return totalB - totalA;
      return a.rider.name.localeCompare(b.rider.name);
    });
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
