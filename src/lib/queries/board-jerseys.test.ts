import { describe, it, expect } from 'vitest';
import {
  buildJerseysByPlayer,
  buildJerseysByRider,
  type JerseyRawRow,
} from './board-jerseys';

const ALICE = '00000000-0000-0000-0000-000000000a1';
const BOB   = '00000000-0000-0000-0000-000000000b0';
const CARO  = '00000000-0000-0000-0000-000000000c0';

const POG = { id: 'r-pog', name: 'Pogačar',  team: 'UAE',     bib: 1 };
const ROG = { id: 'r-rog', name: 'Roglič',   team: 'RBH',    bib: 21 };
const VIN = { id: 'r-vin', name: 'Vingegaard', team: 'Visma', bib: 11 };

function pick(
  userId: string,
  displayName: string,
  kind: 'points' | 'white',
  rider: typeof POG,
): JerseyRawRow {
  return {
    user_id: userId,
    kind,
    profiles: { display_name: displayName },
    riders: rider,
  };
}

describe('buildJerseysByPlayer', () => {
  it('orders rows by playerOrder; pivots kind into named slots', () => {
    const rows: JerseyRawRow[] = [
      pick(BOB,   'Bob',   'points', POG),
      pick(BOB,   'Bob',   'white',  VIN),
      pick(ALICE, 'Alice', 'points', ROG),
      pick(ALICE, 'Alice', 'white',  VIN),
    ];
    const out = buildJerseysByPlayer(rows, [ALICE, BOB]);
    expect(out.map((r) => r.userId)).toEqual([ALICE, BOB]);
    expect(out[0].picks.points?.id).toBe('r-rog');
    expect(out[0].picks.white?.id).toBe('r-vin');
    expect(out[1].picks.points?.id).toBe('r-pog');
    expect(out[1].picks.white?.id).toBe('r-vin');
  });

  it('partial fill: player with only points has white = null', () => {
    const rows: JerseyRawRow[] = [pick(ALICE, 'Alice', 'points', POG)];
    const out = buildJerseysByPlayer(rows, [ALICE]);
    expect(out[0].picks.points?.id).toBe('r-pog');
    expect(out[0].picks.white).toBeNull();
  });

  it('player in playerOrder with no jersey rows has both slots null', () => {
    const rows: JerseyRawRow[] = [pick(ALICE, 'Alice', 'points', POG)];
    const out = buildJerseysByPlayer(rows, [ALICE, BOB]);
    expect(out[1].userId).toBe(BOB);
    expect(out[1].picks).toEqual({ points: null, white: null });
  });

  it('returns empty when both rows and playerOrder are empty', () => {
    expect(buildJerseysByPlayer([], [])).toEqual([]);
  });
});
