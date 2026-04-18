export const STAGE_POINT_TABLE: readonly number[] = [25, 15, 10, 8, 6, 5, 4, 3, 2, 1] as const;

export type StageStatusForScoring = 'upcoming' | 'locked' | 'results_draft' | 'published' | 'cancelled' | 'draft';

export interface StageMeta {
  double_points: boolean;
  status: StageStatusForScoring;
}

export interface StageResult {
  position: number;  // 1..10
  rider_id: string;
}

export interface PickRef {
  rider_id: string;
}

export function stagePoints(pick: PickRef, stage: StageMeta, results: readonly StageResult[]): number {
  if (stage.status !== 'published') return 0;
  const hit = results.find(r => r.rider_id === pick.rider_id);
  if (!hit || hit.position < 1 || hit.position > 10) return 0;
  const base = STAGE_POINT_TABLE[hit.position - 1];
  return stage.double_points ? base * 2 : base;
}
