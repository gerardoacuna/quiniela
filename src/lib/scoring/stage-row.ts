import { stagePoints, type StageMeta, type StageResult } from './stage';

export interface StageRowPick {
  rider_id: string;
  underdog_rider_id: string | null;
}

export interface StageRowPointsResult {
  primary: number;
  underdog: number;
  total: number;
}

export function stageRowPoints(
  pick: StageRowPick,
  stage: StageMeta,
  results: readonly StageResult[],
): StageRowPointsResult {
  const primary = stagePoints({ rider_id: pick.rider_id }, stage, results);
  const underdog = pick.underdog_rider_id
    ? stagePoints({ rider_id: pick.underdog_rider_id }, stage, results)
    : 0;
  return { primary, underdog, total: primary + underdog };
}
