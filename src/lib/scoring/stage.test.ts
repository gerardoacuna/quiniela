import { describe, it, expect } from 'vitest';
import { stagePoints, STAGE_POINT_TABLE } from './stage';

describe('stagePoints', () => {
  const results = [
    { position: 1,  rider_id: 'r1' },
    { position: 2,  rider_id: 'r2' },
    { position: 3,  rider_id: 'r3' },
    { position: 4,  rider_id: 'r4' },
    { position: 5,  rider_id: 'r5' },
    { position: 6,  rider_id: 'r6' },
    { position: 7,  rider_id: 'r7' },
    { position: 8,  rider_id: 'r8' },
    { position: 9,  rider_id: 'r9' },
    { position: 10, rider_id: 'r10' },
  ];

  it('awards 25 points for 1st place', () => {
    expect(stagePoints({ rider_id: 'r1' }, { double_points: false, status: 'published' }, results)).toBe(25);
  });

  it('awards 2 points for 10th place', () => {
    expect(stagePoints({ rider_id: 'r10' }, { double_points: false, status: 'published' }, results)).toBe(2);
  });

  it('awards 0 points when rider is outside top 10', () => {
    expect(stagePoints({ rider_id: 'r99' }, { double_points: false, status: 'published' }, results)).toBe(0);
  });

  it('doubles points on double_points stages', () => {
    expect(stagePoints({ rider_id: 'r1' }, { double_points: true, status: 'published' }, results)).toBe(50);
    expect(stagePoints({ rider_id: 'r5' }, { double_points: true, status: 'published' }, results)).toBe(22);
  });

  it('returns 0 when stage is not published', () => {
    expect(stagePoints({ rider_id: 'r1' }, { double_points: false, status: 'results_draft' as const }, results)).toBe(0);
    expect(stagePoints({ rider_id: 'r1' }, { double_points: false, status: 'cancelled' as const }, results)).toBe(0);
  });

  it('STAGE_POINT_TABLE is 10 entries, descending from 25 to 2', () => {
    expect(STAGE_POINT_TABLE).toEqual([25, 20, 16, 13, 11, 9, 7, 5, 3, 2]);
  });
});
