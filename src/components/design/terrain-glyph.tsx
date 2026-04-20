export type Terrain = 'flat' | 'hilly' | 'mountain' | 'itt';

const PATHS: Record<Terrain, string> = {
  flat:     'M1 10 L15 10',
  hilly:    'M1 11 C 4 7, 6 7, 8 10 C 10 13, 12 5, 15 9',
  mountain: 'M1 13 L5 5 L8 10 L11 3 L15 13',
  itt:      'M1 10 L15 10 M10 7 L13 10 L10 13',
};

export function TerrainGlyph({ terrain, size = 14, color = 'currentColor' }: {
  terrain: Terrain; size?: number; color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[terrain]} />
    </svg>
  );
}
