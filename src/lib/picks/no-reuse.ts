import type { StageStatusForScoring } from '@/lib/scoring';

export interface ExistingPick {
  stage_id: string;
  rider_id: string;
  stage_status: StageStatusForScoring;
  stage_number: number;
}

export type NoReuseResult =
  | { ok: true }
  | { ok: false; reason: 'rider_already_used'; conflictingStageNumber: number };

export function validateNoReuse(
  existing: readonly ExistingPick[],
  targetStageId: string,
  targetRiderId: string,
): NoReuseResult {
  for (const pick of existing) {
    if (pick.stage_id === targetStageId) continue;
    if (pick.stage_status === 'cancelled') continue;
    if (pick.rider_id !== targetRiderId) continue;
    return {
      ok: false,
      reason: 'rider_already_used',
      conflictingStageNumber: pick.stage_number,
    };
  }
  return { ok: true };
}
