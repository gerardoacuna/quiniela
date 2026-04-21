import Link from 'next/link';
import { Countdown } from '@/components/design/countdown';
import { Badge } from '@/components/design/badge';
import { BibTile } from '@/components/design/bib-tile';
import { TeamChip } from '@/components/design/team-chip';
import { StageProfile } from '@/components/design/stage-profile';
import { TerrainGlyph } from '@/components/design/terrain-glyph';
import { fmtDate } from '@/components/design/time';
import type { Terrain } from '@/components/design/terrain-glyph';

const TERRAIN_LABEL: Record<Terrain, string> = {
  flat: 'Flat',
  hilly: 'Hilly',
  mountain: 'Mountain',
  itt: 'ITT',
};

export type HeroStage = {
  id: string;
  number: number;
  start_time: string;
  counts_for_scoring: boolean;
  double_points: boolean;
  terrain: Terrain;
  km: number;
};

export type HeroPick = {
  rider: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
  };
} | null;

export function HeroNextStage({
  stage,
  pick,
  nextStageHref,
  stageHref,
}: {
  stage: HeroStage;
  pick: HeroPick;
  nextStageHref: string;
  stageHref: string;
}) {
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--radius)',
      padding: '22px 20px 20px',
    }}>
      {/* Accent corner blob */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 140,
        height: 140,
        background: 'var(--accent)',
        opacity: 0.08,
        borderRadius: 200,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: 1.2,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}>
            Next stage · {fmtDate(stage.start_time)}
          </div>
          <h1 style={{
            margin: '4px 0 0',
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--display-weight)' as React.CSSProperties['fontWeight'],
            fontSize: 40,
            lineHeight: 1,
            letterSpacing: -0.6,
            color: 'var(--ink)',
          }}>
            Stage <span style={{ color: 'var(--accent)' }}>{stage.number}</span>
          </h1>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)', marginTop: 6, fontWeight: 500 }}>
            {stage.km}km · {TERRAIN_LABEL[stage.terrain]}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid var(--hair)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'var(--ink-soft)',
            }}>
              <TerrainGlyph terrain={stage.terrain} color="var(--ink-soft)" size={12} />
              {TERRAIN_LABEL[stage.terrain]}
            </span>
            {stage.double_points && (
              <Badge tone="accent" size="sm">2× points</Badge>
            )}
            {stage.counts_for_scoring && (
              <Badge tone="outline" size="sm">Counted</Badge>
            )}
          </div>
        </div>
        <Countdown iso={stage.start_time} />
      </div>

      <div style={{ height: 1, background: 'var(--hair)', margin: '18px 0 14px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StageProfile terrain={stage.terrain} w={160} h={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {pick ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BibTile num={pick.rider.bib} size={34} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 10,
                  letterSpacing: 1.2,
                  color: 'var(--ink-mute)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                }}>
                  Your pick
                </div>
                <div style={{
                  fontWeight: 600,
                  fontSize: 15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {pick.rider.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TeamChip team={pick.rider.team} size={10} />
                  <span>{pick.rider.team ?? ''}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34,
                height: 40,
                border: '1.5px dashed var(--accent)',
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
              }}>
                ?
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 10,
                  letterSpacing: 1.2,
                  color: 'var(--ink-mute)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                }}>
                  Your pick
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent)' }}>
                  No rider yet
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  You&apos;re missing points.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Link
          href={nextStageHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: '1px solid var(--accent)',
            padding: '11px 16px',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            minHeight: 42,
            flex: 1,
            textDecoration: 'none',
          }}
        >
          {pick ? 'Change pick' : 'Pick a rider'} →
        </Link>
        <Link
          href={stageHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'transparent',
            color: 'var(--ink)',
            border: '1px solid var(--hair)',
            padding: '11px 16px',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            minHeight: 42,
            textDecoration: 'none',
          }}
        >
          Stage info
        </Link>
      </div>
    </section>
  );
}
