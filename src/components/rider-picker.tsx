'use client';

import { RiderRow } from '@/components/design/rider-row';

export interface PickerRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: 'active' | 'dnf' | 'dns';
  /** If set, shows "Already picked — Stage N" and marks unpickable. */
  usedOnStageNumber?: number;
  /** Custom reason to show instead of auto-generated hint. Implies unpickable. */
  disabledReason?: string;
}

export function RiderPicker({
  riders,
  selectedId,
  onSelect,
  disableUsed = true,
  disableInactive = true,
}: {
  riders: PickerRider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disableUsed?: boolean;
  disableInactive?: boolean;
}) {
  return (
    <ul
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        padding: 0,
        listStyle: 'none',
        margin: 0,
      }}
    >
      {riders.length === 0 && (
        <li
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--ink-mute)',
            fontSize: 13,
          }}
        >
          No riders match your search.
        </li>
      )}
      {riders.map((r) => {
        const disabled =
          (disableInactive && r.status !== 'active') ||
          (disableUsed &&
            (r.usedOnStageNumber !== undefined || r.disabledReason !== undefined) &&
            r.id !== selectedId);

        const hint: string | null = r.id !== selectedId
          ? r.disabledReason
            ? r.disabledReason
            : r.usedOnStageNumber !== undefined
              ? `Already picked — Stage ${r.usedOnStageNumber}`
              : r.status === 'dnf'
                ? 'DNF'
                : r.status === 'dns'
                  ? 'DNS'
                  : null
          : null;

        const checkmark =
          selectedId === r.id ? (
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 13,
                fontWeight: 700,
                flex: 'none',
              }}
            >
              ✓
            </span>
          ) : null;

        return (
          <li key={r.id}>
            <RiderRow
              rider={r}
              selected={selectedId === r.id}
              disabled={disabled}
              hint={hint}
              onClick={() => !disabled && onSelect(r.id)}
              right={checkmark}
            />
          </li>
        );
      })}
    </ul>
  );
}
