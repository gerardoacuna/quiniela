export interface JerseyPick {
  rider_id: string;
}

export function jerseyPoints(pick: JerseyPick | null, actualWinnerRiderId: string | null): number {
  if (!pick || !actualWinnerRiderId) return 0;
  return pick.rider_id === actualWinnerRiderId ? 30 : 0;
}
