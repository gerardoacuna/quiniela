export interface JerseyPick {
  rider_id: string;
}

export const JERSEY_POINTS = 50;

export function jerseyPoints(pick: JerseyPick | null, actualWinnerRiderId: string | null): number {
  if (!pick || !actualWinnerRiderId) return 0;
  return pick.rider_id === actualWinnerRiderId ? JERSEY_POINTS : 0;
}
