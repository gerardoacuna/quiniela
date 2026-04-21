import { Card } from '@/components/design/card';
import type { RankedLeaderboardRow } from '@/lib/scoring';

function StatCell({ label, value, pending = false }: {
  label: string;
  value: number;
  pending?: boolean;
}) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        color: 'var(--ink-mute)',
        letterSpacing: 1,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 18,
        fontWeight: 600,
        color: pending ? 'var(--ink-mute)' : 'var(--ink)',
      }}>
        {pending ? '—' : value}
      </div>
    </div>
  );
}

export function StandingCard({
  me,
  board,
}: {
  me: RankedLeaderboardRow | null;
  board: RankedLeaderboardRow[];
}) {
  if (!me) {
    return (
      <Card>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}>
          Your standing
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-soft)' }}>
          No ranking yet.
        </div>
      </Card>
    );
  }

  const aheadRow = me.rank > 1 ? board.find((r) => r.rank === me.rank - 1) : undefined;
  const behindRow = board.find((r) => r.rank === me.rank + 1);
  const aheadGap = aheadRow ? aheadRow.total_points - me.total_points : 0;
  const behindGap = behindRow ? me.total_points - behindRow.total_points : 0;

  return (
    <Card>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: 1.4,
        color: 'var(--ink-mute)',
        textTransform: 'uppercase',
      }}>
        Your standing
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 4,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 'var(--display-weight)' as React.CSSProperties['fontWeight'],
          fontSize: 46,
          lineHeight: 1,
          color: 'var(--ink)',
        }}>
          {me.rank}
          <span style={{ fontSize: 22, color: 'var(--ink-mute)' }}>/{board.length}</span>
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--accent)',
          fontWeight: 700,
          padding: '4px 8px',
          background: 'var(--accent-soft)',
          borderRadius: 4,
          whiteSpace: 'nowrap',
        }}>
          {me.total_points} pts
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        {aheadGap > 0 && aheadRow && (
          <div>↑ {aheadGap} pts behind {aheadRow.display_name}</div>
        )}
        {behindGap > 0 && behindRow && (
          <div>↓ {behindGap} pts ahead of {behindRow.display_name}</div>
        )}
      </div>
      <div style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px dashed var(--hair)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6,
      }}>
        <StatCell label="Stage" value={me.stage_points} />
        <StatCell label="GC" value={me.gc_points} pending={me.gc_points === 0} />
        <StatCell label="★ Exact" value={me.exact_winners_count} />
      </div>
    </Card>
  );
}
