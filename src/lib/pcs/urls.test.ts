import { describe, it, expect } from 'vitest';
import { pcsStageResultsUrl, pcsStartlistUrl, pcsFinalGcUrl, pcsFinalPointsUrl } from './urls';

describe('pcs url builders', () => {
  it('builds the stage results URL', () => {
    expect(pcsStageResultsUrl('giro-d-italia', 2026, 1))
      .toBe('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-1');
    expect(pcsStageResultsUrl('giro-d-italia', 2026, 21))
      .toBe('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-21');
  });

  it('builds the startlist URL', () => {
    expect(pcsStartlistUrl('giro-d-italia', 2026))
      .toBe('https://www.procyclingstats.com/race/giro-d-italia/2026/startlist');
  });

  it('builds the GC / points URLs', () => {
    expect(pcsFinalGcUrl('giro-d-italia', 2026))
      .toBe('https://www.procyclingstats.com/race/giro-d-italia/2026/gc');
    expect(pcsFinalPointsUrl('giro-d-italia', 2026))
      .toBe('https://www.procyclingstats.com/race/giro-d-italia/2026/points');
  });

  it('rejects stage numbers outside 1..21', () => {
    expect(() => pcsStageResultsUrl('giro-d-italia', 2026, 0)).toThrow();
    expect(() => pcsStageResultsUrl('giro-d-italia', 2026, 22)).toThrow();
  });
});
