'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/design/badge';
import { TerrainGlyph, type Terrain } from '@/components/design/terrain-glyph';

export type TimelineStage = {
  id: string;
  number: number;
  counts_for_scoring: boolean;
  double_points: boolean;
  status: 'upcoming' | 'locked' | 'results_draft' | 'published' | 'cancelled';
  terrain: Terrain;
  km: number;
  /** Whether the current user has a pick for this stage */
  hasPick: boolean;
  /** Points earned (if stage is published + user had a pick) */
  points: number | null;
};

function TimelineCell({ stage, isCurrent }: { stage: TimelineStage; isCurrent: boolean }) {
  const isScored = stage.status === 'published';
  const isLocked = stage.status === 'locked' || stage.status === 'results_draft';

  const href = isScored || !stage.counts_for_scoring
    ? `/stage/${stage.number}`
    : `/picks/stage/${stage.number}`;

  const borderColor = isCurrent ? 'var(--accent)' : 'var(--hair)';
  const numColor = isCurrent ? 'var(--accent)' : isLocked ? 'var(--ink-mute)' : 'var(--ink-soft)';
  const bgColor = isLocked ? 'var(--surface-alt)' : 'var(--surface)';

  return (
    <Link
      href={href}
      data-current={isCurrent ? 'true' : 'false'}
      style={{
        flex: 'none',
        width: 132,
        scrollSnapAlign: 'start',
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 'var(--radius)',
        padding: 10,
        textAlign: 'left',
        cursor: 'pointer',
        color: 'var(--ink)',
        position: 'relative',
        textDecoration: 'none',
        display: 'block',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1, color: 'var(--ink-mute)' }}>
          ST {String(stage.number).padStart(2, '0')}
        </span>
        {stage.double_points && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>2×</span>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 'var(--display-weight)' as React.CSSProperties['fontWeight'],
        fontStyle: 'var(--font-display-italic, normal)' as React.CSSProperties['fontStyle'],
        fontSize: 24,
        lineHeight: 1,
        margin: '4px 0 6px',
        color: numColor,
      }}>
        {stage.number}
      </div>
      <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <TerrainGlyph terrain={stage.terrain} color="var(--ink-mute)" size={12} />
        <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
          {stage.km}km
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        {!stage.counts_for_scoring ? (
          <Badge tone="muted" size="xs">Not counted</Badge>
        ) : isScored ? (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            color: (stage.points ?? 0) > 0 ? 'var(--accent)' : 'var(--ink-mute)',
          }}>
            {stage.points != null ? `+${stage.points}` : '—'}
          </span>
        ) : isCurrent ? (
          <Badge tone={stage.hasPick ? 'soft' : 'accent'} size="xs">
            {stage.hasPick ? 'Picked' : 'Pick now'}
          </Badge>
        ) : !stage.hasPick && !isLocked ? (
          <Badge tone="outline" size="xs">Needs pick</Badge>
        ) : (
          <Badge tone="outline" size="xs">{stage.hasPick ? 'Picked' : 'Open'}</Badge>
        )}
      </div>
    </Link>
  );
}

export function StageTimeline({
  stages,
  currentNumber,
}: {
  stages: TimelineStage[];
  currentNumber: number | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current.querySelector("[data-current='true']");
    if (el) {
      el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
    }
  }, []);

  return (
    <section>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '0 2px 8px',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}>
          {stages.length} Stages · swipe →
        </div>
        <Link href="/picks" style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'none',
        }}>
          All picks
        </Link>
      </div>
      <div
        ref={scrollerRef}
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: 6,
          scrollbarWidth: 'thin',
        }}
      >
        {stages.map((s) => (
          <TimelineCell
            key={s.id}
            stage={s}
            isCurrent={s.number === currentNumber}
          />
        ))}
      </div>
    </section>
  );
}
