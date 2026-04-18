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
  usedOnStageNumber?: number;
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
            (disableUsed && r.usedOnStageNumber !== undefined && r.id !== selectedId);
          const selected = r.id === selectedId;
          return (
            <li
              key={r.id}
              className={`flex items-center justify-between px-3 py-2 border-b last:border-b-0 ${
                disabled ? 'opacity-40' : 'cursor-pointer hover:bg-muted'
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
                {r.usedOnStageNumber !== undefined && r.id !== selectedId && (
                  <Badge variant="secondary">Stage {r.usedOnStageNumber}</Badge>
                )}
                {selected && <Badge>Selected</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
