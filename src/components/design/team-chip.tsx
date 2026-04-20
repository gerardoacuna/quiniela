import type { CSSProperties } from 'react';
import { resolveTeam } from './teams';

export function TeamChip({ team, size = 22, style }: {
  team: string | null | undefined;
  size?: number;
  style?: CSSProperties;
}) {
  const t = resolveTeam(team);
  return (
    <span
      title={t.name}
      style={{
        width: size, height: size, borderRadius: 4, flex: 'none',
        background: t.color, position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)', ...style,
      }}
    >
      <span style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, transparent 0 55%, ${t.accent} 55% 100%)`,
      }} />
    </span>
  );
}
