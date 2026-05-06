export interface GcPick {
  position: number;
  rider_id: string;
}

export interface GcActual {
  position: number;
  rider_id: string;
}

export function gcPoints(picks: readonly GcPick[], actual: readonly GcActual[]): number {
  if (actual.length === 0) return 0;
  const podium = new Set(actual.map(a => a.rider_id));
  const exactByPos = new Map(actual.map(a => [a.position, a.rider_id] as const));

  let total = 0;
  for (const pick of picks) {
    const exactRider = exactByPos.get(pick.position);
    if (exactRider && exactRider === pick.rider_id) {
      total += 50;
    } else if (podium.has(pick.rider_id)) {
      total += 25;
    }
  }
  return total;
}
