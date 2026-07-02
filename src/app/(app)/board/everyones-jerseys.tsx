import { Card } from '@/components/design/card';
import { BibTile } from '@/components/design/bib-tile';
import {
  getBoardJerseysData,
  buildJerseysByPlayer,
  buildJerseysByRider,
  type BoardJerseysByPlayerRow,
  type BoardJerseysByRiderEntry,
  type JerseyKind,
} from '@/lib/queries/board-jerseys';

export async function EveryonesJerseys({
  editionId,
  currentUserId,
  totalPlayers,
  playerOrder,
}: {
  editionId: string;
  currentUserId: string;
  totalPlayers: number;
  playerOrder: string[];
}) {
  const data = await getBoardJerseysData(editionId);

  if (!data.isLocked) {
    return (
      <PreLockPlaceholder
        title="Everyone's jerseys"
        count={data.submissionCount}
        total={totalPlayers}
      />
    );
  }

  const byPlayer = buildJerseysByPlayer(data.rawRows, playerOrder);
  const byRider = buildJerseysByRider(data.rawRows, currentUserId);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader eyebrow="Everyone's jerseys" title="Locked in" />
      <PlayerGroupedCard rows={byPlayer} currentUserId={currentUserId} />
      <RiderGroupedCard kind="points" rows={byRider.points} />
      <RiderGroupedCard kind="white" rows={byRider.white} />
    </section>
  );
}

// ---------------- inline presentational pieces ----------------

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 20,
          marginTop: 2,
        }}
      >
        {title}
      </div>
    </div>
  );
}

function PreLockPlaceholder({
  title,
  count,
  total,
}: {
  title: string;
  count: number;
  total: number;
}) {
  return (
    <Card>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 18,
          marginTop: 6,
        }}
      >
        {count} of {total} players have locked in
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
        Reveals at stage 1 start.
      </div>
    </Card>
  );
}

function PlayerGroupedCard({
  rows,
  currentUserId,
}: {
  rows: BoardJerseysByPlayerRow[];
  currentUserId: string;
}) {
  return (
    <Card pad={0}>
      <div
        style={{
          padding: '10px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.2,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
          borderBottom: '1px solid var(--hair)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
        }}
      >
        <span>Player</span>
        <span>Points</span>
        <span>White</span>
      </div>
      {rows.map((r) => {
        const isMe = r.userId === currentUserId;
        const empty = !r.picks.points && !r.picks.white;
        return (
          <div
            key={r.userId}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--hair)',
              background: isMe ? 'var(--row-you-bg)' : 'transparent',
              borderLeft: `3px solid ${isMe ? 'var(--row-you-bar)' : 'transparent'}`,
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            <span style={{ fontWeight: isMe ? 700 : 500 }}>
              {isMe ? 'You' : r.displayName || '—'}
            </span>
            {empty ? (
              <span
                style={{
                  gridColumn: 'span 2',
                  color: 'var(--ink-mute)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
              >
                didn&apos;t lock in
              </span>
            ) : (
              <>
                <RiderSlot rider={r.picks.points} />
                <RiderSlot rider={r.picks.white} />
              </>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function RiderSlot({
  rider,
}: {
  rider: BoardJerseysByPlayerRow['picks']['points'];
}) {
  if (!rider) return <span style={{ color: 'var(--ink-mute)' }}>—</span>;
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}
    >
      <BibTile num={rider.bib} size={20} />
      <span
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {rider.name}
      </span>
    </span>
  );
}

function RiderGroupedCard({
  kind,
  rows,
}: {
  kind: JerseyKind;
  rows: BoardJerseysByRiderEntry[];
}) {
  if (rows.length === 0) return null;
  const label = kind === 'points' ? 'Points jersey' : 'White jersey';
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
          Consensus
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 18,
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--hair)' }}>
        {rows.map((r) => (
          <div
            key={r.rider.id}
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--hair)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <BibTile num={r.rider.bib} size={24} />
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.rider.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {r.names.length} picker{r.names.length === 1 ? '' : 's'}
              </div>
            </div>
            <div
              style={{
                flexBasis: '100%',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
              }}
            >
              {r.names.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: 'var(--surface-alt)',
                    color: name === 'You' ? 'var(--accent)' : 'var(--ink-soft)',
                    fontWeight: name === 'You' ? 700 : 500,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
