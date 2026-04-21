import { TeamChip } from '@/components/design/team-chip';

interface UsedEntry {
  riderId: string;
  lastName: string;
  team: string | null;
  stageNumber: number;
}

export function UsedRidersStrip({
  entries,
  totalCountedStages,
}: {
  entries: UsedEntry[];
  totalCountedStages: number;
}) {
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--surface-alt)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
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
          Riders you&apos;ve used · {entries.length}/{totalCountedStages}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Each rider only once per edition</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {entries.map((e) => (
          <span
            key={e.riderId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px 4px 4px',
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 999,
              fontSize: 11,
            }}
          >
            <TeamChip team={e.team} size={12} />
            {e.lastName}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-mute)',
                fontWeight: 600,
              }}
            >
              S{e.stageNumber}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
