import { describe, it, expect } from 'vitest';
import { parseStartlist } from './parse-startlist';
import { readFixture } from '@test/helpers/read-fixture';

describe('parseStartlist', () => {
  const html = readFixture('startlist.html');
  const riders = parseStartlist(html);

  it('extracts a plausible number of riders (50-300)', () => {
    expect(riders.length).toBeGreaterThan(50);
    expect(riders.length).toBeLessThan(300);
  });

  it('all rider slugs are unique and valid', () => {
    const slugs = new Set(riders.map(r => r.rider_slug));
    expect(slugs.size).toBe(riders.length);
    riders.forEach(r => expect(r.rider_slug).toMatch(/^[a-z0-9-]+$/));
  });

  it('all riders have team_name and rider_name populated', () => {
    riders.forEach(r => {
      expect(r.rider_name.length).toBeGreaterThan(0);
      expect(r.team_name.length).toBeGreaterThan(0);
    });
  });

  it('includes a known rider (Mads Pedersen)', () => {
    const mp = riders.find(r => r.rider_slug === 'mads-pedersen');
    expect(mp).toBeDefined();
  });

  it('throws on trivially invalid HTML', () => {
    expect(() => parseStartlist('<html><body>nothing</body></html>')).toThrow();
  });
});
