import Link from 'next/link';
import { Countdown } from '@/components/design/countdown';
import { Badge } from '@/components/design/badge';
import { fmtDate } from '@/components/design/time';

export function HeroPreRace({
  stage1StartIso,
  gcDone,
  pointsDone,
  youthDone,
}: {
  stage1StartIso: string;
  gcDone: boolean;
  pointsDone: boolean;
  youthDone: boolean;
}) {
  const allDone = gcDone && pointsDone && youthDone;
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--radius)',
      padding: '22px 20px 20px',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 140, height: 140,
        background: 'var(--accent)', opacity: 0.08, borderRadius: 200, pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1.2,
            color: 'var(--ink-mute)', textTransform: 'uppercase',
          }}>
            Pre-race · locks {fmtDate(stage1StartIso)}
          </div>
          <h1 style={{
            margin: '4px 0 0',
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--display-weight)' as React.CSSProperties['fontWeight'],
            fontSize: 40, lineHeight: 1, letterSpacing: -0.6, color: 'var(--ink)',
          }}>
            {allDone ? 'Pre-race picks locked in' : 'Make your pre-race picks'}
          </h1>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)', marginTop: 6, fontWeight: 500 }}>
            GC Top 5 · Points jersey · Youth jersey
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <StatusChip label="GC Top 5" done={gcDone} />
            <StatusChip label="Points jersey" done={pointsDone} />
            <StatusChip label="Youth jersey" done={youthDone} />
          </div>
        </div>
        <Countdown iso={stage1StartIso} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Link
          href="/picks"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--accent)', color: 'var(--accent-ink)', border: '1px solid var(--accent)',
            padding: '11px 16px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 14,
            fontFamily: 'var(--font-body)', minHeight: 42, flex: 1, textDecoration: 'none',
          }}
        >
          {allDone ? 'Review pre-race picks' : 'Make pre-race picks'} →
        </Link>
      </div>
    </section>
  );
}

function StatusChip({ label, done }: { label: string; done: boolean }) {
  return done
    ? <Badge tone="ok" size="sm">✓ {label}</Badge>
    : <Badge tone="muted" size="sm">{label}</Badge>;
}
