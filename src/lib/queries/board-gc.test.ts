import { describe, it, expect } from 'vitest';
import {
  buildGcByPlayer,
  buildGcByRider,
  type GcRawRow,
} from './board-gc';

const ALICE = '00000000-0000-0000-0000-000000000a1';
const BOB   = '00000000-0000-0000-0000-000000000b0';
const CARO  = '00000000-0000-0000-0000-000000000c0';

const POG = { id: 'r-pog', name: 'Pogačar',  team: 'UAE',     bib: 1 };
const VIN = { id: 'r-vin', name: 'Vingegaard', team: 'Visma', bib: 11 };
const ROG = { id: 'r-rog', name: 'Roglič',   team: 'RBH',    bib: 21 };

function pick(userId: string, displayName: string, position: 1 | 2 | 3, rider: typeof POG): GcRawRow {
  return {
    user_id: userId,
    position,
    profiles: { display_name: displayName },
    riders: rider,
  };
}

describe('buildGcByPlayer', () => {
  it('orders rows by playerOrder', () => {
    const rows: GcRawRow[] = [
      pick(BOB,  'Bob',  1, VIN),
      pick(BOB,  'Bob',  2, POG),
      pick(BOB,  'Bob',  3, ROG),
      pick(ALICE,'Alice',1, POG),
      pick(ALICE,'Alice',2, VIN),
      pick(ALICE,'Alice',3, ROG),
    ];
    const out = buildGcByPlayer(rows, [ALICE, BOB]);
    expect(out.map((r) => r.userId)).toEqual([ALICE, BOB]);
    expect(out[0].picks.p1?.id).toBe('r-pog');
    expect(out[1].picks.p1?.id).toBe('r-vin');
  });

  it('includes a player from playerOrder with no gc_picks rows (all slots null)', () => {
    const rows: GcRawRow[] = [pick(ALICE, 'Alice', 1, POG)];
    const out = buildGcByPlayer(rows, [ALICE, BOB]);
    expect(out).toHaveLength(2);
    expect(out[1].userId).toBe(BOB);
    expect(out[1].picks).toEqual({ p1: null, p2: null, p3: null });
  });

  it('handles partial slates (only p1 set)', () => {
    const rows: GcRawRow[] = [pick(ALICE, 'Alice', 1, POG)];
    const out = buildGcByPlayer(rows, [ALICE]);
    expect(out[0].picks.p1?.id).toBe('r-pog');
    expect(out[0].picks.p2).toBeNull();
    expect(out[0].picks.p3).toBeNull();
  });

  it('uses the displayName from the first row seen for that user', () => {
    const rows: GcRawRow[] = [pick(ALICE, 'Alice', 2, VIN), pick(ALICE, 'Alice', 1, POG)];
    const out = buildGcByPlayer(rows, [ALICE]);
    expect(out[0].displayName).toBe('Alice');
  });

  it('returns empty when both rows and playerOrder are empty', () => {
    expect(buildGcByPlayer([], [])).toEqual([]);
  });
});
