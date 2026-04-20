import type { Terrain } from './terrain-glyph';

const CFG: Record<Terrain, number[]> = {
  flat:     [0.2, 0.22, 0.25, 0.2, 0.24, 0.22, 0.26, 0.3, 0.2, 0.18, 0.22, 0.25],
  hilly:    [0.22, 0.45, 0.3, 0.55, 0.35, 0.6, 0.4, 0.7, 0.45, 0.55, 0.35, 0.3],
  mountain: [0.15, 0.25, 0.5, 0.4, 0.7, 0.55, 0.85, 0.65, 0.95, 0.7, 0.5, 0.4],
  itt:      [0.15, 0.2, 0.22, 0.18, 0.22, 0.2, 0.18, 0.22, 0.2, 0.18, 0.22, 0.2],
};

export function StageProfile({ terrain, w = 220, h = 36, accent = 'var(--accent)', soft = 'var(--accent-soft)' }: {
  terrain: Terrain; w?: number; h?: number; accent?: string; soft?: string;
}) {
  const cfg = CFG[terrain];
  const step = w / (cfg.length - 1);
  const pts = cfg.map((v, i) => [i * step, h - v * h]);
  const d = 'M ' + pts.map((p) => p.join(',')).join(' L ');
  const area = d + ` L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={area} fill={soft} opacity={0.55} />
      <path d={d} fill="none" stroke={accent} strokeWidth={1.4} />
    </svg>
  );
}
