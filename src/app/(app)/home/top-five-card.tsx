import Link from 'next/link';
import { Card } from '@/components/design/card';
import type { RankedLeaderboardRow } from '@/lib/scoring';

function BoardMiniRow({ row, isMe }: { row: RankedLeaderboardRow; isMe: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '30px 1fr auto auto',
      gap: 10,
      alignItems: 'center',
      padding: '10px 16px',
      borderTop: '1px solid var(--hair)',
      background: isMe ? 'var(--accent-soft)' : 'transparent',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        fontSize: 13,
        color: isMe ? 'var(--accent)' : 'var(--ink-soft)',
      }}>
        {row.rank}
      </span>
      <span style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: 'var(--ink)' }}>
        {isMe ? 'You' : row.display_name}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
        ★ {row.exact_winners_count}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--ink)',
        minWidth: 38,
        textAlign: 'right',
      }}>
        {row.total_points}
      </span>
    </div>
  );
}

export function TopFiveCard({
  rows,
  around,
  me,
}: {
  rows: RankedLeaderboardRow[];
  around: RankedLeaderboardRow[];
  me: RankedLeaderboardRow | null;
}) {
  return (
    <Card pad={0}>
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.4,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}>
            Leaderboard
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--font-display-weight)' as React.CSSProperties['fontWeight'],
            fontSize: 20,
            marginTop: 2,
          }}>
            Top five
          </div>
        </div>
        <Link href="/board" style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'none',
        }}>
          Full board →
        </Link>
      </div>
      <div>
        {rows.map((r) => (
          <BoardMiniRow key={r.user_id} row={r} isMe={me?.user_id === r.user_id} />
        ))}
        {me && me.rank > 5 && around.length > 0 && (
          <>
            <div style={{
              padding: '6px 16px',
              fontSize: 10,
              color: 'var(--ink-mute)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 1,
              borderTop: '1px dashed var(--hair)',
            }}>
              · · ·
            </div>
            {around.map((r) => (
              <BoardMiniRow key={r.user_id} row={r} isMe={me.user_id === r.user_id} />
            ))}
          </>
        )}
      </div>
    </Card>
  );
}
