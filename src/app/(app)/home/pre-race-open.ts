// True during the pre-race window: stage 1 exists and hasn't started yet.
// Fails closed (false) when the start time is missing or unparseable.
export function isPreRaceOpen(
  stage1StartIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (!stage1StartIso) return false;
  const start = Date.parse(stage1StartIso);
  if (Number.isNaN(start)) return false;
  return nowMs < start;
}
