import { stagePoints, type StageMeta, type StageResult } from './stage';

export interface StageRowPick {
  rider_id: string;
  hedge_rider_id: string | null;
}

export interface StageRowPointsResult {
  primary: number;
  hedge: number;
  total: number;
}

export function stageRowPoints(
  pick: StageRowPick,
  stage: StageMeta,
  results: readonly StageResult[],
): StageRowPointsResult {
  const primary = stagePoints({ rider_id: pick.rider_id }, stage, results);
  const hedge = pick.hedge_rider_id
    ? stagePoints({ rider_id: pick.hedge_rider_id }, stage, results)
    : 0;
  return { primary, hedge, total: primary + hedge };
}
