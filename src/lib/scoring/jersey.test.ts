import { describe, it, expect } from 'vitest';
import { jerseyPoints, JERSEY_POINTS } from './jersey';

describe('jerseyPoints', () => {
  it('exports the points constant as 50', () => {
    expect(JERSEY_POINTS).toBe(50);
  });

  it('returns 50 when pick matches actual winner', () => {
    expect(jerseyPoints({ rider_id: 'pogacar' }, 'pogacar')).toBe(50);
  });

  it('returns 0 when pick differs', () => {
    expect(jerseyPoints({ rider_id: 'pogacar' }, 'ayuso')).toBe(0);
  });

  it('returns 0 when pick is null (no pick submitted)', () => {
    expect(jerseyPoints(null, 'pogacar')).toBe(0);
  });

  it('returns 0 when winner is null (not yet published)', () => {
    expect(jerseyPoints({ rider_id: 'pogacar' }, null)).toBe(0);
  });
});
