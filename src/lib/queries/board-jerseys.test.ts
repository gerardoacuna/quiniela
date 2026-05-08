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

describe('buildJerseysByRider', () => {
  it("groups by kind; per-kind outer order = pickers desc; chips alphabetical with 'You' first", () => {
    const rows: JerseyRawRow[] = [
      // Points: Pog x3 (all three players)
      pick(ALICE, 'Alice', 'points', POG),
      pick(BOB,   'Bob',   'points', POG),
      pick(CARO,  'Caro',  'points', POG),
      // White: Vin x2 (Alice, Caro)
      pick(ALICE, 'Alice', 'white',  VIN),
      pick(CARO,  'Caro',  'white',  VIN),
    ];
    const out = buildJerseysByRider(rows, ALICE);

    // Points: only Pog appears (no rogue rows in this test)
    expect(out.points.map((r) => r.rider.id)).toEqual(['r-pog']);
    expect(out.points[0].names).toEqual(['You', 'Bob', 'Caro']);

    // White: only Vin appears
    expect(out.white.map((r) => r.rider.id)).toEqual(['r-vin']);
    expect(out.white[0].names).toEqual(['You', 'Caro']);
  });

  it('orders riders by pick count desc, alphabetical name on ties', () => {
    const rows: JerseyRawRow[] = [
      pick(ALICE, 'Alice', 'points', POG),
      pick(BOB,   'Bob',   'points', ROG),
      pick(CARO,  'Caro',  'points', POG), // Pog gets 2 pickers, Rog 1
    ];
    const out = buildJerseysByRider(rows, ALICE);
    expect(out.points.map((r) => r.rider.id)).toEqual(['r-pog', 'r-rog']);
  });

  it("doesn't list a player's name for a kind they didn't fill", () => {
    const rows: JerseyRawRow[] = [
      pick(ALICE, 'Alice', 'points', POG),
      // Alice has no white pick
    ];
    const out = buildJerseysByRider(rows, ALICE);
    expect(out.white).toEqual([]);
  });

  it('handles empty input', () => {
    expect(buildJerseysByRider([], ALICE)).toEqual({ points: [], white: [] });
  });

  it("does not conflate the current user with another user whose display_name is literally 'You'", () => {
    // ALICE is current user. BOB's display_name is literally 'You'. CARO is unrelated.
    // The current user must be pinned first by userId, not by string equality —
    // otherwise BOB would also pin first because his name is 'You'.
    const rows: JerseyRawRow[] = [
      pick(ALICE, 'Alice', 'points', POG),
      pick(BOB,   'You',   'points', POG),
      pick(CARO,  'Caro',  'points', POG),
    ];
    const out = buildJerseysByRider(rows, ALICE);
    // Current user pinned first, then alphabetical: 'Caro' (C) < 'You' (Y).
    expect(out.points[0].names).toEqual(['You', 'Caro', 'You']);
  });
});
