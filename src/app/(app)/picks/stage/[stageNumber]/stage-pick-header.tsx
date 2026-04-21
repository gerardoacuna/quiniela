import { Badge } from '@/components/design/badge';
import { TerrainGlyph, type Terrain } from '@/components/design/terrain-glyph';
import { StageProfile } from '@/components/design/stage-profile';
import { fmtDate, fmtTime } from '@/components/design/time';

function terrainLabel(terrain: string): string {
  if (terrain === 'itt') return 'ITT';
  return terrain.charAt(0).toUpperCase() + terrain.slice(1);
}

export function StagePickHeader({
  stageNumber,
  terrain,
  km,
  doublePoints,
  startTimeIso,
}: {
  stageNumber: number;
  terrain: string;
  km: number | null;
  doublePoints: boolean;
  startTimeIso: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        padding: 16,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}
      >
        Stage {stageNumber} · pick a rider
      </div>
      <h1
        style={{
          margin: '4px 0 6px',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 28,
          lineHeight: 1.05,
          letterSpacing: -0.4,
          color: 'var(--ink)',
        }}
      >
        Stage {stageNumber}
      </h1>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone="muted" size="sm">
          <TerrainGlyph terrain={terrain as Terrain} size={11} />
          {terrainLabel(terrain)}
        </Badge>
        {doublePoints && (
          <Badge tone="accent" size="sm">
            2× points
          </Badge>
        )}
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          · {km != null ? `${km} km` : '—'} · locks {fmtDate(startTimeIso)} at {fmtTime(startTimeIso)}
        </span>
      </div>
      <div style={{ marginTop: 10, overflow: 'hidden' }}>
        <StageProfile terrain={terrain as Terrain} w={300} h={40} />
      </div>
    </div>
  );
}
