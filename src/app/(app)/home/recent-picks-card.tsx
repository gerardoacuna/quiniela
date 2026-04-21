import Link from 'next/link';
import { Card } from '@/components/design/card';
import { TeamChip } from '@/components/design/team-chip';
import { ordinal } from '@/components/design/time';

export type RecentPick = {
  stageN: number;
  rider: {
    name: string;
    team: string | null;
  };
  position: number | null;
  points: number;
};

export function RecentPicksCard({ recent }: { recent: RecentPick[] }) {
  return (
    <Card pad={0}>
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}>
          Recent picks
        </div>
        <Link href="/me" style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'none',
        }}>
          See all
        </Link>
      </div>
      {recent.length === 0 ? (
        <div style={{
          padding: '12px 16px 16px',
          fontSize: 13,
          color: 'var(--ink-mute)',
          borderTop: '1px solid var(--hair)',
        }}>
          No scored picks yet.
        </div>
      ) : (
        recent.map((r) => {
          const hit = r.points > 0;
          return (
            <Link
              key={r.stageN}
              href={`/stage/${r.stageN}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--hair)',
                cursor: 'pointer',
                color: 'var(--ink)',
                textAlign: 'left',
                textDecoration: 'none',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-mute)',
                width: 28,
                flexShrink: 0,
              }}>
                S{r.stageN}
              </div>
              <TeamChip team={r.rider.team} size={10} />
              <div style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {r.rider.name}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-soft)',
                textAlign: 'right',
              }}>
                {ordinal(r.position)}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 600,
                color: hit ? 'var(--accent)' : 'var(--ink-mute)',
                width: 40,
                textAlign: 'right',
              }}>
                +{r.points}
              </div>
            </Link>
          );
        })
      )}
    </Card>
  );
}
