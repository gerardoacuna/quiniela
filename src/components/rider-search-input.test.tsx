import { describe, it, expect } from 'vitest';
import { filterRidersByQuery } from './rider-search-input';

const RIDERS = [
  { id: '1', name: 'Tadej Pogačar',     team: 'UAE Team Emirates',    bib: 1,  status: 'active' as const },
  { id: '2', name: 'Jonas Vingegaard',  team: 'Visma Lease a Bike',   bib: 11, status: 'active' as const },
  { id: '3', name: 'Juan Ayuso',        team: 'UAE Team Emirates',    bib: 2,  status: 'active' as const },
];

describe('filterRidersByQuery', () => {
  it('returns all riders when query is empty or whitespace', () => {
    expect(filterRidersByQuery(RIDERS, '')).toHaveLength(3);
    expect(filterRidersByQuery(RIDERS, '   ')).toHaveLength(3);
  });

  it('matches by name, case-insensitive', () => {
    expect(filterRidersByQuery(RIDERS, 'AYUSO').map((r) => r.id)).toEqual(['3']);
    expect(filterRidersByQuery(RIDERS, 'jonas').map((r) => r.id)).toEqual(['2']);
  });

  it('matches names with diacritics typed without accents', () => {
    expect(filterRidersByQuery(RIDERS, 'pogacar').map((r) => r.id)).toEqual(['1']);
    expect(filterRidersByQuery(RIDERS, 'POGAC').map((r) => r.id)).toEqual(['1']);
  });

  it('matches by team', () => {
    expect(filterRidersByQuery(RIDERS, 'visma').map((r) => r.id)).toEqual(['2']);
  });

  it('matches by bib number', () => {
    expect(filterRidersByQuery(RIDERS, '11').map((r) => r.id)).toEqual(['2']);
  });

  it('returns empty array on no match', () => {
    expect(filterRidersByQuery(RIDERS, 'zzz')).toEqual([]);
  });
});
