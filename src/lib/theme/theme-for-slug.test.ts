import { describe, it, expect } from 'vitest';
import { themeForSlug } from './theme-for-slug';

describe('themeForSlug', () => {
  it('maps tour slugs to tour', () => {
    expect(themeForSlug('tour-de-france-2026')).toBe('tour');
  });
  it('maps giro slugs to giro', () => {
    expect(themeForSlug('giro-2026')).toBe('giro');
  });
  it('falls back to giro for unknown, empty, null, undefined', () => {
    expect(themeForSlug('vuelta-2026')).toBe('giro');
    expect(themeForSlug('')).toBe('giro');
    expect(themeForSlug(null)).toBe('giro');
    expect(themeForSlug(undefined)).toBe('giro');
  });
});
