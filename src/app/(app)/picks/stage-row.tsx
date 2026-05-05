import Link from 'next/link';
import { Badge } from '@/components/design/badge';
import { TerrainGlyph, type Terrain } from '@/components/design/terrain-glyph';
import { TeamChip } from '@/components/design/team-chip';
import { fmtDate, ordinal } from '@/components/design/time';

const POINTS_TABLE = [25, 15, 10, 8, 6, 5, 4, 3, 2, 1];

function terrainLabel(terrain: string): string {
  if (terrain === 'itt') return 'ITT';
  return terrain.charAt(0).toUpperCase() + terrain.slice(1);
}

interface StageRiderPick {
  riderId: string;
  riderName: string;
  riderTeam: string | null;
}

interface StageRowProps {
  number: number;
  startTime: string;
  terrain: string;
  km: number | null;
  doublePoints: boolean;
  status: string;
  locked: boolean;
  isNext: boolean;
  pick?: StageRiderPick | null;
  underdogPick?: StageRiderPick | null;
  result?: { position: number } | null;
  underdogResult?: { position: number } | null;
}

function pickPoints(position: number | undefined, doublePoints: boolean): number {
  if (!position || position < 1 || position > 10) return 0;
  const base = POINTS_TABLE[position - 1] ?? 0;
  return doublePoints ? base * 2 : base;
}

export function StageRow({
  number,
  startTime,
  terrain,
  km,
  doublePoints,
  status,
  locked,
  isNext,
  pick,
  underdogPick,
  result,
  underdogResult,
}: StageRowProps) {
  const scored = status === 'published';

  const primaryPts = scored && pick && result ? pickPoints(result.position, doublePoints) : 0;
  const underdogPts = scored && underdogPick && underdogResult ? pickPoints(underdogResult.position, doublePoints) : 0;
  const totalPts = primaryPts + underdogPts;

  let statusNode: React.ReactNode;
  if (scored) {
    statusNode = (
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 700,
          color: totalPts > 0 ? 'var(--accent)' : 'var(--ink-mute)',
        }}
      >
        +{totalPts}
      </div>
    );
  } else if (locked) {
    statusNode = <Badge tone="muted">Locked</Badge>;
  } else if (pick) {
    statusNode = <Badge tone="soft">Picked</Badge>;
  } else {
    statusNode = <Badge tone="accent">Pick</Badge>;
  }

  const href = locked || scored ? `/stage/${number}` : `/picks/stage/${number}`;

  return (
    <Link
      href={href}
      style={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr auto',
        gap: 12,
        alignItems: 'center',
        background: 'var(--surface)',
        border: `1px solid ${isNext ? 'var(--accent)' : 'var(--hair)'}`,
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
        textDecoration: 'none',
        color: 'var(--ink)',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 30,
            lineHeight: 1,
            color: isNext ? 'var(--accent)' : 'var(--ink)',
          }}
        >
          {number}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--ink-mute)',
            letterSpacing: 1,
            marginTop: 2,
            textTransform: 'uppercase',
          }}
        >
          {fmtDate(startTime)}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{terrainLabel(terrain)}</span>
          {doublePoints && <Badge tone="accent" size="xs">2×</Badge>}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            fontSize: 12,
            color: 'var(--ink-soft)',
          }}
        >
          <TerrainGlyph terrain={terrain as Terrain} color="var(--ink-soft)" />
          <span>{km != null ? `${km} km` : '—'}</span>
        </div>
        {pick && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1, color: 'var(--ink-mute)' }}>P</span>
            <TeamChip team={pick.riderTeam} size={10} />
            <span style={{ color: 'var(--ink)' }}>{pick.riderName}</span>
            {scored && (
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {result?.position ? ordinal(result.position) : '—'} (+{primaryPts})
              </span>
            )}
          </div>
        )}
        {underdogPick && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1, color: 'var(--ink-mute)' }}>U</span>
            <TeamChip team={underdogPick.riderTeam} size={10} />
            <span style={{ color: 'var(--ink)' }}>{underdogPick.riderName}</span>
            {scored && (
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {underdogResult?.position ? ordinal(underdogResult.position) : '—'} (+{underdogPts})
              </span>
            )}
          </div>
        )}
      </div>

      {statusNode}
    </Link>
  );
}
