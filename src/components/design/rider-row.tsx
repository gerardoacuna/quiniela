'use client';
import type { ReactNode } from 'react';
import { BibTile } from './bib-tile';
import { TeamChip } from './team-chip';
import { resolveTeam } from './teams';

export interface RiderRowRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: 'active' | 'dnf' | 'dns';
}

export function RiderRow({
  rider, right, onClick, disabled, hint, dense, selected,
}: {
  rider: RiderRowRider;
  right?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string | null;
  dense?: boolean;
  selected?: boolean;
}) {
  const team = resolveTeam(rider.team);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={rider.name}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        textAlign: 'left',
        padding: dense ? '10px 12px' : '14px 14px',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        border: `1px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        borderBottom: '1px solid var(--hair)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        color: 'var(--ink)',
        borderRadius: 0,
      }}
    >
      <BibTile num={rider.bib} size={30} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {rider.name}
          </span>
          {rider.status === 'dnf' && (
            <span style={{ fontSize: 10, padding: '2px 6px', border: '1px solid var(--hair)', color: 'var(--ink-mute)', borderRadius: 999, textTransform: 'uppercase', fontWeight: 600 }}>DNF</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <TeamChip team={rider.team} size={9} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 1 }}>{hint}</div>
        )}
      </div>
      {right}
    </button>
  );
}
