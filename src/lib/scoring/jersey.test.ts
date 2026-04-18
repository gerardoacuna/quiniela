import { describe, it, expect } from 'vitest';
import { jerseyPoints } from './jersey';

describe('jerseyPoints', () => {
  it('returns 30 when pick matches actual winner', () => {
    expect(jerseyPoints({ rider_id: 'pogacar' }, 'pogacar')).toBe(30);
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
