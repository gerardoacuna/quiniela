'use client';
import { useState, useTransition } from 'react';
import { updateStageFlags } from '@/lib/actions/admin-edition';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/types/database';

type Stage = Database['public']['Tables']['stages']['Row'];
type StageTerrain = Database['public']['Enums']['stage_terrain'];

const TERRAIN_OPTIONS: { value: StageTerrain; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'hilly', label: 'Hilly' },
  { value: 'mountain', label: 'Mountain' },
  { value: 'itt', label: 'ITT' },
];

export function EditionForm({ editionId, stages }: { editionId: string; stages: Stage[] }) {
  const [local, setLocal] = useState(
    stages.map((s) => ({
      id: s.id,
      number: s.number,
      counts_for_scoring: s.counts_for_scoring,
      double_points: s.double_points,
      terrain: s.terrain,
      km: s.km,
    })),
  );
  const [status, setStatus] = useState<null | 'saving' | 'saved' | string>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edition setup</h1>
      <p className="text-sm text-muted-foreground">Toggle which stages count for scoring and which are double-points. Save applies all changes at once.</p>

      <table className="w-full text-sm border rounded">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left">Stage</th>
            <th className="p-2">Counts</th>
            <th className="p-2">2×</th>
            <th className="p-2 text-left">Terrain</th>
            <th className="p-2 text-left">Km</th>
          </tr>
        </thead>
        <tbody>
          {local.map((s, i) => (
            <tr key={s.id} className="border-t">
              <td className="p-2">Stage {s.number}</td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={s.counts_for_scoring}
                  onChange={(e) => {
                    const copy = [...local];
                    copy[i] = { ...copy[i], counts_for_scoring: e.target.checked };
                    setLocal(copy);
                  }}
                />
              </td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={s.double_points}
                  onChange={(e) => {
                    const copy = [...local];
                    copy[i] = { ...copy[i], double_points: e.target.checked };
                    setLocal(copy);
                  }}
                />
              </td>
              <td className="p-2">
                <select
                  className="border rounded px-1 py-0.5 text-sm"
                  value={s.terrain}
                  onChange={(e) => {
                    const copy = [...local];
                    copy[i] = { ...copy[i], terrain: e.target.value as StageTerrain };
                    setLocal(copy);
                  }}
                >
                  {TERRAIN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <input
                  type="number"
                  min={0}
                  max={400}
                  className="border rounded px-1 py-0.5 text-sm w-20"
                  value={s.km}
                  onChange={(e) => {
                    const copy = [...local];
                    copy[i] = { ...copy[i], km: Number(e.target.value) };
                    setLocal(copy);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button
        disabled={pending}
        onClick={() => {
          setStatus('saving');
          startTransition(async () => {
            const res = await updateStageFlags({
              editionId,
              stages: local.map((s) => ({
                id: s.id,
                counts_for_scoring: s.counts_for_scoring,
                double_points: s.double_points,
                terrain: s.terrain,
                km: s.km,
              })),
            });
            setStatus(res.ok ? 'saved' : res.error);
          });
        }}
      >
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {status === 'saved' && <p className="text-sm text-green-600">Saved.</p>}
      {typeof status === 'string' && status !== 'saving' && status !== 'saved' && (
        <p className="text-sm text-red-600">{status}</p>
      )}
    </div>
  );
}
