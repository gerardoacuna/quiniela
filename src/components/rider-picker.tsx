'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface PickerRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: 'active' | 'dnf' | 'dns';
  /** If set, shows "Stage N" and marks unpickable. */
  usedOnStageNumber?: number;
  /** Custom reason to show instead of "Stage N" (e.g. "Another slot"). Implies unpickable. */
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
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.team ?? '').toLowerCase().includes(q) ||
      (r.bib != null && String(r.bib).includes(q))
    );
  }, [riders, query]);

  return (
    <div className="space-y-2">
      <Input placeholder="Search name, team, bib…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="border rounded max-h-80 overflow-y-auto">
        {filtered.map((r) => {
          const disabled =
            (disableInactive && r.status !== 'active') ||
            (disableUsed && (r.usedOnStageNumber !== undefined || r.disabledReason !== undefined) && r.id !== selectedId);
          const selected = r.id === selectedId;
          return (
            <li key={r.id} className="border-b last:border-b-0">
              <button
                type="button"
                aria-label={r.name}
                aria-pressed={selected}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3 py-2 text-left ${
                  disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'
                } ${selected ? 'bg-primary/10' : ''}`}
                onClick={() => !disabled && onSelect(r.id)}
              >
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.bib ? `#${r.bib} · ` : ''}{r.team ?? ''}
                  </div>
                </div>
                <div className="text-xs">
                  {r.status !== 'active' && <Badge variant="destructive" className="mr-1">{r.status.toUpperCase()}</Badge>}
                  {r.id !== selectedId && r.disabledReason !== undefined && (
                    <Badge variant="secondary">{r.disabledReason}</Badge>
                  )}
                  {r.id !== selectedId && r.disabledReason === undefined && r.usedOnStageNumber !== undefined && (
                    <Badge variant="secondary">Stage {r.usedOnStageNumber}</Badge>
                  )}
                  {selected && <Badge>Selected</Badge>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
