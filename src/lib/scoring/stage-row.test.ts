import { describe, it, expect } from 'vitest';
import { stageRowPoints } from './stage-row';

const STAGE = { double_points: false, status: 'published' as const };
const STAGE_2X = { double_points: true, status: 'published' as const };

const RESULTS = [
  { position: 1, rider_id: 'P1' },
  { position: 3, rider_id: 'P3' },
  { position: 7, rider_id: 'P7' },
];

describe('stageRowPoints', () => {
  it('returns primary only when hedge is null', () => {
    expect(stageRowPoints({ rider_id: 'P3', hedge_rider_id: null }, STAGE, RESULTS))
      .toEqual({ primary: 10, hedge: 0, total: 10 });
  });

  it('sums primary + hedge when both score', () => {
    expect(stageRowPoints({ rider_id: 'P3', hedge_rider_id: 'P7' }, STAGE, RESULTS))
      .toEqual({ primary: 10, hedge: 4, total: 14 });
  });

  it('returns 0 + 0 when neither scores', () => {
    expect(stageRowPoints({ rider_id: 'X', hedge_rider_id: 'Y' }, STAGE, RESULTS))
      .toEqual({ primary: 0, hedge: 0, total: 0 });
  });

  it('doubles both contributions on a 2x stage', () => {
    // P1 base=25, P7 base=4. Doubled: 50 + 8 = 58.
    expect(stageRowPoints({ rider_id: 'P1', hedge_rider_id: 'P7' }, STAGE_2X, RESULTS))
      .toEqual({ primary: 50, hedge: 8, total: 58 });
  });

  it('returns zero when stage status is not published', () => {
    expect(stageRowPoints({ rider_id: 'P1', hedge_rider_id: 'P3' }, { double_points: false, status: 'locked' }, RESULTS))
      .toEqual({ primary: 0, hedge: 0, total: 0 });
  });
});
