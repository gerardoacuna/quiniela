import { Card } from '@/components/design/card';
import { BibTile } from '@/components/design/bib-tile';
import {
  getBoardGcData,
  buildGcByPlayer,
  buildGcByRider,
  type BoardGcByPlayerRow,
  type BoardGcByRiderRow,
} from '@/lib/queries/board-gc';

export async function EveryonesGc({
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
  const data = await getBoardGcData(editionId);

  if (!data.isLocked) {
    return (
      <PreLockPlaceholder
        title="Everyone's GC"
        count={data.submissionCount}
        total={totalPlayers}
      />
    );
  }

  const byPlayer = buildGcByPlayer(data.rawRows, playerOrder);
  const byRider = buildGcByRider(data.rawRows, currentUserId);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader eyebrow="Everyone's GC" title="Locked in" />
      <PlayerGroupedCard rows={byPlayer} currentUserId={currentUserId} />
      <RiderGroupedCard rows={byRider} />
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
  rows: BoardGcByPlayerRow[];
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
          gridTemplateColumns: '1.4fr repeat(5, 1fr)',
          gap: 10,
        }}
      >
        <span>Player</span>
        <span>1st</span>
        <span>2nd</span>
        <span>3rd</span>
        <span>4th</span>
        <span>5th</span>
      </div>
      {rows.map((r) => {
        const isMe = r.userId === currentUserId;
        const empty = !r.picks.p1 && !r.picks.p2 && !r.picks.p3;
        return (
          <div
            key={r.userId}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr repeat(5, 1fr)',
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
                  gridColumn: 'span 5',
                  color: 'var(--ink-mute)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
              >
                didn&apos;t lock in
              </span>
            ) : (
              <>
                <RiderSlot rider={r.picks.p1} />
                <RiderSlot rider={r.picks.p2} />
                <RiderSlot rider={r.picks.p3} />
                <RiderSlot rider={r.picks.p4} />
                <RiderSlot rider={r.picks.p5} />
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
  rider: BoardGcByPlayerRow['picks']['p1'];
}) {
  if (!rider) return <span style={{ color: 'var(--ink-mute)' }}>—</span>;
  return <BibTile num={rider.bib} size={20} />;
}

function RiderGroupedCard({ rows }: { rows: BoardGcByRiderRow[] }) {
  if (rows.length === 0) return null;
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
          Who picked whom
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
                {r.p1Names.length + r.p2Names.length + r.p3Names.length + r.p4Names.length + r.p5Names.length} pick
                {r.p1Names.length + r.p2Names.length + r.p3Names.length + r.p4Names.length + r.p5Names.length === 1
                  ? ''
                  : 's'}
              </div>
            </div>
            <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(['p1', 'p2', 'p3', 'p4', 'p5'] as const).map((slot) => {
                const names =
                  slot === 'p1' ? r.p1Names
                  : slot === 'p2' ? r.p2Names
                  : slot === 'p3' ? r.p3Names
                  : slot === 'p4' ? r.p4Names
                  : r.p5Names;
                if (names.length === 0) return null;
                const label =
                  slot === 'p1' ? '1st'
                  : slot === 'p2' ? '2nd'
                  : slot === 'p3' ? '3rd'
                  : slot === 'p4' ? '4th'
                  : '5th';
                return (
                  <div key={slot} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--ink-mute)',
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        marginRight: 4,
                      }}
                    >
                      {label}
                    </span>
                    {names.map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: 'var(--surface-alt)',
                          color: name === 'You' ? 'var(--accent-text)' : 'var(--ink-soft)',
                          fontWeight: name === 'You' ? 700 : 500,
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
