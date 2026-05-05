'use client';
import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { upsertRidersFromStartlist, setRiderStatus, setRiderTopTier } from '@/lib/actions/admin-rider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type R = { id: string; name: string; team: string | null; bib: number | null; status: 'active' | 'dnf' | 'dns'; pcs_slug: string; is_top_tier: boolean };

export function RidersTable({
  editionId, editionSlug, year, riders,
}: { editionId: string; editionSlug: string; year: number; riders: R[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.team ?? '').toLowerCase().includes(q) ||
      r.pcs_slug.includes(q) ||
      (r.bib != null && String(r.bib).includes(q))
    );
  }, [riders, query]);

  // Derive the PCS race slug from the edition slug: 'giro-2026' → 'giro-d-italia'.
  // For flexibility we hardcode the Giro for now; a future edition can plumb this through properly.
  const raceSlug = 'giro-d-italia';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Riders</h1>
          <p className="text-xs text-muted-foreground">{riders.length} in edition &middot; {editionSlug}</p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Fetch startlist from procyclingstats.com for ${raceSlug}/${year}? This hits PCS.`)) return;
            setStatus('fetching');
            startTransition(async () => {
              const r = await upsertRidersFromStartlist({ editionId, raceSlug, year });
              if (r.ok) {
                setStatus(`Upserted ${r.data.count} riders.`);
                router.refresh();
              } else {
                setStatus(r.error);
              }
            });
          }}
        >{pending ? 'Fetching\u2026' : 'Refresh from PCS startlist'}</Button>
      </div>

      <Input placeholder="Search name, team, bib, slug\u2026" value={query} onChange={(e) => setQuery(e.target.value)} />
      {status && <p className="text-sm">{status}</p>}

      <table className="w-full text-sm border rounded">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left">Bib</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Team</th>
            <th className="p-2">Status</th>
            <th className="p-2">Top tier</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-mono">{r.bib ?? '\u2014'}</td>
              <td className="p-2">{r.name}</td>
              <td className="p-2 text-muted-foreground">{r.team ?? ''}</td>
              <td className="p-2 text-center">
                <select
                  value={r.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as 'active' | 'dnf' | 'dns';
                    startTransition(async () => {
                      const res = await setRiderStatus(r.id, newStatus);
                      if (res.ok) router.refresh();
                      else setStatus(res.error);
                    });
                  }}
                  className="border rounded px-1 py-0.5 text-xs"
                >
                  <option value="active">active</option>
                  <option value="dnf">dnf</option>
                  <option value="dns">dns</option>
                </select>
              </td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={r.is_top_tier}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.checked;
                    startTransition(async () => {
                      const res = await setRiderTopTier(r.id, next);
                      if (res.ok) router.refresh();
                      else setStatus(res.error);
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
