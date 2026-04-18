import { describe, it, expect } from 'vitest';
import { parseClassification } from './parse-final';
import { readFixture } from '@test/helpers/read-fixture';

describe('parseClassification', () => {
  it('parses final GC top placings', () => {
    const html = readFixture('final-gc.html');
    const entries = parseClassification(html);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries[0].position).toBe(1);
    expect(entries[1].position).toBe(2);
    expect(entries[2].position).toBe(3);
    // 2025 Giro winner: Simon Yates
    expect(entries[0].rider_slug).toBe('simon-yates');
  });

  it('parses final points classification', () => {
    const html = readFixture('final-points.html');
    const entries = parseClassification(html);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].position).toBe(1);
    // 2025 points jersey winner: Mads Pedersen
    expect(entries[0].rider_slug).toBe('mads-pedersen');
  });

  it('throws when no results table', () => {
    expect(() => parseClassification('<html></html>')).toThrow();
  });
});
