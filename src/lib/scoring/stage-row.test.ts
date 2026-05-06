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
  it('returns primary only when underdog is null', () => {
    expect(stageRowPoints({ rider_id: 'P3', underdog_rider_id: null }, STAGE, RESULTS))
      .toEqual({ primary: 16, underdog: 0, total: 16 });
  });

  it('sums primary + underdog when both score', () => {
    expect(stageRowPoints({ rider_id: 'P3', underdog_rider_id: 'P7' }, STAGE, RESULTS))
      .toEqual({ primary: 16, underdog: 7, total: 23 });
  });

  it('returns 0 + 0 when neither scores', () => {
    expect(stageRowPoints({ rider_id: 'X', underdog_rider_id: 'Y' }, STAGE, RESULTS))
      .toEqual({ primary: 0, underdog: 0, total: 0 });
  });

  it('doubles both contributions on a 2x stage', () => {
    // P1 base=25, P7 base=7. Doubled: 50 + 14 = 64.
    expect(stageRowPoints({ rider_id: 'P1', underdog_rider_id: 'P7' }, STAGE_2X, RESULTS))
      .toEqual({ primary: 50, underdog: 14, total: 64 });
  });

  it('returns zero when stage status is not published', () => {
    expect(stageRowPoints({ rider_id: 'P1', underdog_rider_id: 'P3' }, { double_points: false, status: 'locked' }, RESULTS))
      .toEqual({ primary: 0, underdog: 0, total: 0 });
  });
});
