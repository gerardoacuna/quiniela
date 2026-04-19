'use client';
import { useState, useTransition } from 'react';
import { updateStageFlags } from '@/lib/actions/admin-edition';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/types/database';

type Stage = Database['public']['Tables']['stages']['Row'];

export function EditionForm({ editionId, stages }: { editionId: string; stages: Stage[] }) {
  const [local, setLocal] = useState(
    stages.map((s) => ({
      id: s.id,
      number: s.number,
      counts_for_scoring: s.counts_for_scoring,
      double_points: s.double_points,
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
          <tr><th className="p-2 text-left">Stage</th><th className="p-2">Counts</th><th className="p-2">2×</th></tr>
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
