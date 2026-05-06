import { describe, it, expect } from 'vitest';
import { gcPoints } from './gc';

describe('gcPoints', () => {
  const actual = [
    { position: 1, rider_id: 'pogacar' },
    { position: 2, rider_id: 'ayuso' },
    { position: 3, rider_id: 'evenepoel' },
  ];

  it('returns 150 when all three exact', () => {
    const picks = [
      { position: 1, rider_id: 'pogacar' },
      { position: 2, rider_id: 'ayuso' },
      { position: 3, rider_id: 'evenepoel' },
    ];
    expect(gcPoints(picks, actual)).toBe(150);
  });

  it('returns 50 when only first place exact', () => {
    const picks = [
      { position: 1, rider_id: 'pogacar' },
      { position: 2, rider_id: 'roglic' },
      { position: 3, rider_id: 'ganna' },
    ];
    expect(gcPoints(picks, actual)).toBe(50);
  });

  it('returns 25 per in-podium but wrong position', () => {
    const picks = [
      { position: 1, rider_id: 'evenepoel' },
      { position: 2, rider_id: 'pogacar' },
      { position: 3, rider_id: 'ayuso' },
    ];
    expect(gcPoints(picks, actual)).toBe(75); // 25 + 25 + 25
  });

  it('returns 0 when no picks match', () => {
    const picks = [
      { position: 1, rider_id: 'roglic' },
      { position: 2, rider_id: 'ganna' },
      { position: 3, rider_id: 'unknown' },
    ];
    expect(gcPoints(picks, actual)).toBe(0);
  });

  it('mixes exact and in-podium', () => {
    const picks = [
      { position: 1, rider_id: 'pogacar' },
      { position: 2, rider_id: 'evenepoel' },
      { position: 3, rider_id: 'roglic' },
    ];
    expect(gcPoints(picks, actual)).toBe(75);
  });

  it('returns 0 when user has no picks', () => {
    expect(gcPoints([], actual)).toBe(0);
  });

  it('returns 0 when final GC is empty (not yet published)', () => {
    expect(gcPoints([
      { position: 1, rider_id: 'pogacar' },
    ], [])).toBe(0);
  });
});
