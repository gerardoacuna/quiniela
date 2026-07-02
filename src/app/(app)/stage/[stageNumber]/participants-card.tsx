import { Card } from '@/components/design/card';
import type { StageDetailData } from '@/lib/queries/stage-detail';

type Rider = StageDetailData['allPicks'][number]['rider'];

export interface ParticipantRow {
  userId: string;
  displayName: string;
  primary: Rider | null;
  primaryPts: number;
  underdog: Rider | null;
  underdogPts: number;
}

interface Props {
  rows: ParticipantRow[];
  scored: boolean;
  currentUserId: string;
}

const GRID = '1fr 1.2fr 44px 1.2fr 44px';

export function ParticipantsCard({ rows, scored, currentUserId }: Props) {
  return (
    <Card pad={0}>
      <div style={{ padding: '14px 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.4,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}
        >
          Participants
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 20,
            marginTop: 2,
          }}
        >
          {scored ? 'Scored' : 'Picks revealed'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: 8,
          padding: '8px 14px',
          borderTop: '1px solid var(--hair)',
          borderBottom: '1px solid var(--hair)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.2,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}
      >
        <span>Player</span>
        <span>Underdog</span>
        <span style={{ textAlign: 'right' }}>Pts</span>
        <span style={{ paddingLeft: 16 }}>Primary</span>
        <span style={{ textAlign: 'right' }}>Pts</span>
      </div>

      {rows.map((r) => {
        const isMe = r.userId === currentUserId;
        return (
          <div
            key={r.userId}
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              gap: 8,
              padding: '10px 14px',
              borderBottom: '1px solid var(--hair)',
              background: isMe ? 'var(--row-you-bg)' : 'transparent',
              borderLeft: `3px solid ${isMe ? 'var(--row-you-bar)' : 'transparent'}`,
              alignItems: 'center',
              fontSize: 12,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontWeight: isMe ? 700 : 500,
                color: isMe ? 'var(--accent-text)' : 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {isMe ? 'You' : r.displayName || '—'}
            </span>

            <RiderSlot rider={r.underdog} />
            <PointsCell value={r.underdogPts} scored={scored} hasPick={r.underdog != null} />

            <span style={{ paddingLeft: 16, minWidth: 0 }}>
              <RiderSlot rider={r.primary} />
            </span>
            <PointsCell value={r.primaryPts} scored={scored} hasPick={r.primary != null} />
          </div>
        );
      })}
    </Card>
  );
}

function RiderSlot({ rider }: { rider: Rider | null }) {
  if (!rider) {
    return (
      <span
        style={{
          display: 'block',
          color: 'var(--ink-mute)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        — no pick
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'block',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {rider.name}
    </span>
  );
}

function PointsCell({
  value,
  scored,
  hasPick,
}: {
  value: number;
  scored: boolean;
  hasPick: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: value > 0 ? 700 : 500,
        color: value > 0 ? 'var(--accent)' : 'var(--ink-mute)',
        textAlign: 'right',
      }}
    >
      {!scored || !hasPick ? '—' : value}
    </span>
  );
}
