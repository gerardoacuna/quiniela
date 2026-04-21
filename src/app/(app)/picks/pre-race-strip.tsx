import Link from 'next/link';
import { Badge } from '@/components/design/badge';
import { BibTile } from '@/components/design/bib-tile';
import { resolveTeam } from '@/components/design/teams';

interface GcPickRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
}

interface JerseyPickRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
}

export function PreRaceStrip({
  gcPicks,
  jerseyPick,
  locked,
}: {
  gcPicks: Array<{ position: number; rider_id: string; riders: GcPickRider }>;
  jerseyPick: { rider_id: string; riders: JerseyPickRider } | null;
  locked: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {/* GC Top 3 card */}
      <MiniPickCard label="GC Top 3" locked={locked} href={locked ? undefined : '/picks/gc'}>
        {gcPicks.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {gcPicks.slice(0, 3).map((g, i) => (
              <div
                key={g.rider_id}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <BibTile num={g.riders.bib} size={26} />
                <div
                  style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: 1,
                    color: 'var(--accent)',
                    fontWeight: 700,
                  }}
                >
                  P{i + 1}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
            Not picked yet
          </div>
        )}
      </MiniPickCard>

      {/* Points jersey card */}
      <MiniPickCard label="Points jersey" locked={locked} href={locked ? undefined : '/picks/jersey'}>
        {jerseyPick ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <BibTile num={jerseyPick.riders.bib} size={26} />
            <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, minWidth: 0 }}>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {jerseyPick.riders.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 400 }}>
                {resolveTeam(jerseyPick.riders.team).name}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
            Not picked yet
          </div>
        )}
      </MiniPickCard>
    </div>
  );
}

function MiniPickCard({
  label,
  locked,
  href,
  children,
}: {
  label: string;
  locked: boolean;
  href?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        padding: 12,
        position: 'relative',
        display: 'block',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.2,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {locked && (
          <Badge tone="muted" size="xs">
            Locked
          </Badge>
        )}
      </div>
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
