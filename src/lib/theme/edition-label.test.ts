import { describe, it, expect } from 'vitest';
import { editionLabel } from './edition-label';

describe('editionLabel', () => {
  it('labels the Tour as TDF with the roman year', () => {
    expect(editionLabel({ slug: 'tour-de-france-2026', start_date: '2026-07-04' })).toBe('TDF · MMXXVI');
  });
  it('labels the Giro as GIRO with the roman year', () => {
    expect(editionLabel({ slug: 'giro-2026', start_date: '2026-05-09' })).toBe('GIRO · MMXXVI');
  });
  it('falls back to GIRO · MMXXVI when no edition', () => {
    expect(editionLabel(null)).toBe('GIRO · MMXXVI');
    expect(editionLabel(undefined)).toBe('GIRO · MMXXVI');
  });
});
