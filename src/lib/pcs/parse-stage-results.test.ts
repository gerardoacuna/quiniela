import { describe, it, expect } from 'vitest';
import { parseStageResults } from './parse-stage-results';
import { readFixture } from '@test/helpers/read-fixture';

describe('parseStageResults', () => {
  const html = readFixture('stage-results.html');
  const entries = parseStageResults(html);

  it('returns at most 10 entries, positions sequential from 1', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(10);
    entries.forEach((e, i) => expect(e.position).toBe(i + 1));
  });

  it('position 1 is Mads Pedersen on Lidl - Trek', () => {
    expect(entries[0].rider_slug).toBe('mads-pedersen');
    expect(entries[0].rider_name.toLowerCase()).toContain('pedersen');
    expect(entries[0].team_name.toLowerCase()).toContain('lidl');
  });

  it('position 2 is Wout van Aert', () => {
    expect(entries[1].rider_slug).toBe('wout-van-aert');
  });

  it('position 3 is Orluis Aular', () => {
    expect(entries[2].rider_slug).toBe('orluis-aular');
  });

  it('all rider_slugs are valid slug format', () => {
    entries.forEach(e => expect(e.rider_slug).toMatch(/^[a-z0-9-]+$/));
  });

  it('throws on invalid HTML', () => {
    expect(() => parseStageResults('<html><body>nope</body></html>')).toThrow();
  });
});
