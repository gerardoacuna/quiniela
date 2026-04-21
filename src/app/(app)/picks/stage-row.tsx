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

interface StageRowProps {
  number: number;
  startTime: string;
  terrain: string;
  km: number | null;
  doublePoints: boolean;
  status: string;
  locked: boolean;
  isNext: boolean;
  pick?: {
    riderId: string;
    riderName: string;
    riderTeam: string | null;
  } | null;
  result?: {
    position: number;
  } | null;
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
  result,
}: StageRowProps) {
  const scored = status === 'published';

  let pts: number | null = null;
  if (scored && pick && result) {
    const base = result.position >= 1 && result.position <= 10
      ? (POINTS_TABLE[result.position - 1] ?? 0)
      : 0;
    pts = doublePoints ? base * 2 : base;
  }

  let statusNode: React.ReactNode;
  if (scored) {
    const posText = result?.position ? `Finished ${ordinal(result.position)}` : 'No top-10';
    const ptsVal = pts ?? 0;
    statusNode = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{posText}</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 700,
            color: ptsVal > 0 ? 'var(--accent)' : 'var(--ink-mute)',
          }}
        >
          +{ptsVal}
        </span>
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
      {/* Left: stage number + date */}
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

      {/* Middle: terrain + km + pick */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{terrainLabel(terrain)}</span>
          {doublePoints && (
            <Badge tone="accent" size="xs">
              2×
            </Badge>
          )}
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
          {pick && (
            <>
              <span>·</span>
              <TeamChip team={pick.riderTeam} size={10} />
              <span style={{ color: 'var(--ink)' }}>{pick.riderName}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: status node */}
      {statusNode}
    </Link>
  );
}
