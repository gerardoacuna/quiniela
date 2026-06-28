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

  const actual5 = [
    { position: 1, rider_id: 'pogacar' },
    { position: 2, rider_id: 'ayuso' },
    { position: 3, rider_id: 'evenepoel' },
    { position: 4, rider_id: 'roglic' },
    { position: 5, rider_id: 'ganna' },
  ];

  it('awards 25 for an exact 4th-place pick', () => {
    const picks = [{ position: 4, rider_id: 'roglic' }];
    expect(gcPoints(picks, actual5)).toBe(25);
  });

  it('awards 25 for an exact 5th-place pick', () => {
    const picks = [{ position: 5, rider_id: 'ganna' }];
    expect(gcPoints(picks, actual5)).toBe(25);
  });

  it('gives 0 for a 4th-place pick whose rider finished 5th (no partial credit on 4/5)', () => {
    const picks = [{ position: 4, rider_id: 'ganna' }];
    expect(gcPoints(picks, actual5)).toBe(0);
  });

  it('gives 0 when a top-3 pick finishes 4th or 5th (podium stays top-3)', () => {
    const picks = [{ position: 1, rider_id: 'roglic' }]; // roglic finished 4th
    expect(gcPoints(picks, actual5)).toBe(0);
  });

  it('top-3 partial credit is unchanged when 4th/5th finishers exist', () => {
    const picks = [
      { position: 1, rider_id: 'evenepoel' }, // in top 3, wrong slot → 25
      { position: 2, rider_id: 'pogacar' },   // in top 3, wrong slot → 25
      { position: 3, rider_id: 'ayuso' },     // in top 3, wrong slot → 25
    ];
    expect(gcPoints(picks, actual5)).toBe(75);
  });

  it('scores a full top-5 slate', () => {
    const picks = [
      { position: 1, rider_id: 'pogacar' },   // 50
      { position: 2, rider_id: 'ayuso' },     // 50
      { position: 3, rider_id: 'evenepoel' }, // 50
      { position: 4, rider_id: 'roglic' },    // 25
      { position: 5, rider_id: 'ganna' },     // 25
    ];
    expect(gcPoints(picks, actual5)).toBe(200);
  });
});
