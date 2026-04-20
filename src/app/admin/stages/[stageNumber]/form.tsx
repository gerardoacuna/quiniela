'use client';
import { useState, useTransition } from 'react';
import { publishStageResults, cancelStage, resetStageToUpcoming } from '@/lib/actions/admin-stage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/lib/types/database';

type Stage = Database['public']['Tables']['stages']['Row'];
type Row = { position: number; rider_id: string };
type RiderOpt = { id: string; name: string; bib: number | null; team: string };

export function StagePublishForm({
  stage, initialRows, riders,
}: { stage: Stage; initialRows: Row[]; riders: RiderOpt[] }) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (initialRows.length) return initialRows;
    return Array.from({ length: 10 }, (_, i) => ({ position: i + 1, rider_id: '' }));
  });
  const [status, setStatus] = useState<null | 'saving' | 'saved' | string>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stage {stage.number}</h1>
        <Badge>{stage.status}</Badge>
      </div>

      <table className="w-full text-sm border rounded">
        <thead className="bg-muted"><tr><th className="p-2">Pos</th><th className="p-2 text-left">Rider</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.position} className="border-t">
              <td className="p-2 text-center font-mono">{r.position}</td>
              <td className="p-2">
                <select
                  aria-label={`Position ${r.position}`}
                  value={r.rider_id}
                  onChange={(e) => {
                    const copy = [...rows];
                    copy[i] = { ...copy[i], rider_id: e.target.value };
                    setRows(copy);
                  }}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">—</option>
                  {riders.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.bib ? `#${opt.bib} ` : ''}{opt.name} — {opt.team}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            const filled = rows.filter((r) => r.rider_id);
            setStatus('saving');
            startTransition(async () => {
              const res = await publishStageResults({ stageId: stage.id, results: filled });
              setStatus(res.ok ? 'saved' : res.error);
            });
          }}
        >
          {pending ? 'Publishing…' : 'Publish'}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => {
          if (!confirm('Cancel this stage? Picks will score 0.')) return;
          startTransition(async () => {
            const res = await cancelStage(stage.id);
            setStatus(res.ok ? 'saved' : res.error);
          });
        }}>Cancel stage</Button>
        <Button variant="ghost" disabled={pending} onClick={() => {
          if (!confirm('Reset to upcoming (clears results)?')) return;
          startTransition(async () => {
            const res = await resetStageToUpcoming(stage.id);
            setStatus(res.ok ? 'saved' : res.error);
          });
        }}>Reset</Button>
      </div>
      {status === 'saved' && <p className="text-sm text-green-600">Results published.</p>}
      {typeof status === 'string' && status !== 'saving' && status !== 'saved' && (
        <p className="text-sm text-red-600">{status}</p>
      )}
    </div>
  );
}
