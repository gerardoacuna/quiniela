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

function pick(userId: string, displayName: string, position: 1 | 2 | 3 | 4 | 5, rider: typeof POG): GcRawRow {
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
    expect(out[1].picks).toEqual({ p1: null, p2: null, p3: null, p4: null, p5: null });
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

  it('fills 4th and 5th slots', () => {
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 1, POG),
      pick(ALICE, 'Alice', 4, VIN),
      pick(ALICE, 'Alice', 5, ROG),
    ];
    const out = buildGcByPlayer(rows, [ALICE]);
    expect(out[0].picks.p4?.id).toBe('r-vin');
    expect(out[0].picks.p5?.id).toBe('r-rog');
    expect(out[0].picks.p2).toBeNull();
  });
});

describe('buildGcByRider', () => {
  it("groups picker names by rider+position; outer order = total pickers desc; chips alphabetical with 'You' first", () => {
    // Three players. Pog gets picked at p1 by all three; Vin at p2 by two; Rog at p3 by one.
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 1, POG),
      pick(BOB,   'Bob',   1, POG),
      pick(CARO,  'Caro',  1, POG),
      pick(ALICE, 'Alice', 2, VIN),
      pick(BOB,   'Bob',   2, VIN),
      pick(CARO,  'Caro',  3, ROG),
    ];
    const out = buildGcByRider(rows, ALICE);
    // Outer order: Pog (3 pickers) > Vin (2) > Rog (1)
    expect(out.map((r) => r.rider.id)).toEqual(['r-pog', 'r-vin', 'r-rog']);

    // Pog at p1: You, Bob, Caro (You pinned first, then alphabetical)
    expect(out[0].p1Names).toEqual(['You', 'Bob', 'Caro']);
    expect(out[0].p2Names).toEqual([]);
    expect(out[0].p3Names).toEqual([]);

    // Vin at p2: You, Bob (You pinned first)
    expect(out[1].p1Names).toEqual([]);
    expect(out[1].p2Names).toEqual(['You', 'Bob']);
    expect(out[1].p3Names).toEqual([]);

    // Rog at p3: Caro alone
    expect(out[2].p3Names).toEqual(['Caro']);
  });

  it('breaks ties on total pickers by rider name ascending', () => {
    // Two riders each picked once at p1 — outer order should be alphabetical.
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 1, VIN),
      pick(BOB,   'Bob',   1, POG),
    ];
    const out = buildGcByRider(rows, ALICE);
    expect(out.map((r) => r.rider.name)).toEqual(['Pogačar', 'Vingegaard']);
  });

  it('handles empty input', () => {
    expect(buildGcByRider([], ALICE)).toEqual([]);
  });

  it('aggregates 4th/5th pickers', () => {
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 4, POG),
      pick(BOB,   'Bob',   5, POG),
    ];
    const out = buildGcByRider(rows, ALICE);
    const pog = out.find((r) => r.rider.id === 'r-pog')!;
    expect(pog.p4Names).toEqual(['You']);
    expect(pog.p5Names).toEqual(['Bob']);
  });

  it("renders names alphabetically when current user is not among pickers", () => {
    // Current user is Caro, who didn't pick Pog at p1.
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 1, POG),
      pick(BOB,   'Bob',   1, POG),
    ];
    const out = buildGcByRider(rows, CARO);
    expect(out[0].p1Names).toEqual(['Alice', 'Bob']);
  });

  it("does not conflate the current user with another user whose display_name is literally 'You'", () => {
    // ALICE is current user. BOB's display_name is literally 'You'. CARO is unrelated.
    // With the bug: BOB and ALICE would both be pinned first ('You' strings),
    // then CARO alphabetical — order: ['You', 'You', 'Caro'].
    // With the fix: only ALICE is pinned first via userId; BOB's 'You' string
    // gets alphabetical sort against 'Caro'. 'C' < 'Y' so CARO comes before BOB.
    // Order: ['You' (Alice), 'Caro', 'You' (Bob)]. The 2nd element is 'Caro'.
    const rows: GcRawRow[] = [
      pick(ALICE, 'Alice', 1, POG),
      pick(BOB,   'You',   1, POG),
      pick(CARO,  'Caro',  1, POG),
    ];
    const out = buildGcByRider(rows, ALICE);
    // Current user is pinned first, then alphabetical. 'C' < 'Y' so 'Caro'
    // comes before BOB's 'You' display name.
    expect(out[0].p1Names).toEqual(['You', 'Caro', 'You']);
  });
});
