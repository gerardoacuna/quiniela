import { describe, it, expect } from 'vitest';
import { ordinal, untilText, untilParts, fmtDate } from './time';

describe('ordinal', () => {
  it('handles 1..4, teens, and 21..24', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(null)).toBe('—');
  });
});

describe('untilText', () => {
  const base = new Date('2026-05-17T10:00:00Z').getTime();
  it('renders days + hours for far future', () => {
    expect(untilText('2026-05-19T12:00:00Z', base)).toBe('2d 2h');
  });
  it('renders hours + minutes for same day', () => {
    expect(untilText('2026-05-17T11:42:00Z', base)).toBe('1h 42m');
  });
  it('renders minutes only for under an hour', () => {
    expect(untilText('2026-05-17T10:30:00Z', base)).toBe('30m');
  });
  it('returns Locked when in the past', () => {
    expect(untilText('2026-05-17T09:00:00Z', base)).toBe('Locked');
  });
});

describe('untilParts', () => {
  it('returns zeroes and locked=true when past', () => {
    const p = untilParts('2026-05-17T09:00:00Z', new Date('2026-05-17T10:00:00Z').getTime());
    expect(p).toEqual({ d: 0, h: 0, m: 0, s: 0, locked: true });
  });
});

// fmtDate is imported but only used here to ensure it's exported correctly
describe('fmtDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    expect(typeof fmtDate('2026-05-09T12:00:00Z')).toBe('string');
    expect(fmtDate('2026-05-09T12:00:00Z').length).toBeGreaterThan(0);
  });
});
