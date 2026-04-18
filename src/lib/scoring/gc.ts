export interface GcPick {
  position: 1 | 2 | 3;
  rider_id: string;
}

export interface GcActual {
  position: 1 | 2 | 3;
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
      total += 30;
    } else if (podium.has(pick.rider_id)) {
      total += 10;
    }
  }
  return total;
}
