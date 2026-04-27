import Link from 'next/link';
import { Card } from '@/components/design/card';
import { TeamChip } from '@/components/design/team-chip';
import { BibTile } from '@/components/design/bib-tile';
import { JerseyGlyph } from '@/components/design/jersey-glyph';

export type GcPickRow = {
  position: number;
  rider: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
  };
};

export type JerseyPickRow = {
  rider: {
    id: string;
    name: string;
    team: string | null;
    bib: number | null;
  };
} | null;

export type JerseyPickRows = {
  points: JerseyPickRow;
  white: JerseyPickRow;
};

function JerseyRow({ kind, label, pick }: { kind: 'points' | 'white'; label: string; pick: JerseyPickRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 11,
        color: 'var(--ink-mute)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      {!pick ? (
        <Link href="/picks/jerseys" style={{
          fontSize: 12,
          color: 'var(--accent)',
          textDecoration: 'underline',
          border: '1px dashed var(--hair)',
          padding: '6px 8px',
          borderRadius: 4,
          display: 'block',
          textAlign: 'center',
        }}>
          Not picked
        </Link>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <JerseyGlyph kind={kind} size={16} />
          <BibTile num={pick.rider.bib} size={20} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{pick.rider.name}</span>
        </div>
      )}
    </div>
  );
}

export function PreRaceCard({
  gcPicks,
  jerseyPicks,
}: {
  gcPicks: GcPickRow[];
  jerseyPicks: JerseyPickRows;
}) {
  return (
    <Card pad={0}>
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}>
          Pre-race picks · locked
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
          Scored after the final classifications are published.
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0,
        borderTop: '1px solid var(--hair)',
      }}>
        <div style={{ padding: '12px 16px', borderRight: '1px solid var(--hair)' }}>
          <div style={{
            fontSize: 11,
            color: 'var(--ink-mute)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            GC Top 3
          </div>
          {gcPicks.length === 0 ? (
            <div style={{ marginTop: 8 }}>
              <Link href="/picks/gc" style={{
                fontSize: 12,
                color: 'var(--accent)',
                textDecoration: 'underline',
                border: '1px dashed var(--hair)',
                padding: '6px 8px',
                borderRadius: 4,
                display: 'block',
                textAlign: 'center',
                marginTop: 4,
              }}>
                No GC pick yet
              </Link>
            </div>
          ) : (
            <ol style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gcPicks.map((p) => (
                <li key={p.position} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--accent)',
                    fontWeight: 700,
                    width: 20,
                    flexShrink: 0,
                  }}>
                    {p.position}.
                  </span>
                  <TeamChip team={p.rider.team} size={10} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.rider.name}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <JerseyRow kind="points" label="Points jersey" pick={jerseyPicks.points} />
          <JerseyRow kind="white"  label="White jersey"  pick={jerseyPicks.white} />
        </div>
      </div>
    </Card>
  );
}
