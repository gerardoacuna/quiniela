import { themeForSlug, type ThemeKey } from './theme-for-slug';

const RACE_WORD: Record<ThemeKey, string> = { giro: 'GIRO', tour: 'TDF' };

function toRoman(year: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = year;
  let out = '';
  for (const [value, sym] of table) {
    while (n >= value) { out += sym; n -= value; }
  }
  return out;
}

export function editionLabel(
  edition: { slug: string; start_date: string } | null | undefined,
): string {
  if (!edition) return 'GIRO · MMXXVI';
  const word = RACE_WORD[themeForSlug(edition.slug)];
  const year = new Date(edition.start_date).getUTCFullYear();
  return `${word} · ${toRoman(year)}`;
}
