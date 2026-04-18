const BASE = 'https://www.procyclingstats.com/race';

export function pcsStageResultsUrl(raceSlug: string, year: number, stageNumber: number): string {
  if (stageNumber < 1 || stageNumber > 21) {
    throw new Error(`stageNumber must be 1..21, got ${stageNumber}`);
  }
  return `${BASE}/${raceSlug}/${year}/stage-${stageNumber}`;
}

export function pcsStartlistUrl(raceSlug: string, year: number): string {
  return `${BASE}/${raceSlug}/${year}/startlist`;
}

export function pcsFinalGcUrl(raceSlug: string, year: number): string {
  return `${BASE}/${raceSlug}/${year}/gc`;
}

export function pcsFinalPointsUrl(raceSlug: string, year: number): string {
  return `${BASE}/${raceSlug}/${year}/points`;
}
