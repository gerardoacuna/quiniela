export type ThemeKey = 'giro' | 'tour';

export function themeForSlug(slug?: string | null): ThemeKey {
  if (slug && slug.startsWith('tour')) return 'tour';
  return 'giro';
}
