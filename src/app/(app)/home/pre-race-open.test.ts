import { describe, it, expect } from 'vitest';
import { isPreRaceOpen } from './pre-race-open';

describe('isPreRaceOpen', () => {
  const start = '2026-07-04T15:05:00+00:00';
  const startMs = Date.parse(start);

  it('is true before stage 1 start', () => {
    expect(isPreRaceOpen(start, startMs - 1)).toBe(true);
  });
  it('is false at/after stage 1 start', () => {
    expect(isPreRaceOpen(start, startMs)).toBe(false);
    expect(isPreRaceOpen(start, startMs + 1)).toBe(false);
  });
  it('is false when stage1 start is missing or invalid', () => {
    expect(isPreRaceOpen(null, startMs)).toBe(false);
    expect(isPreRaceOpen(undefined, startMs)).toBe(false);
    expect(isPreRaceOpen('not-a-date', startMs)).toBe(false);
  });
});
