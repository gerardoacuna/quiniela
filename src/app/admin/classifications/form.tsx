'use client';
import { useState, useTransition } from 'react';
import { publishFinal } from '@/lib/actions/admin-final';
import { Button } from '@/components/ui/button';

type RiderOpt = { id: string; name: string; bib: number | null; team: string };

function RiderSelect({
  value, onChange, riders, id,
}: { value: string; onChange: (v: string) => void; riders: RiderOpt[]; id: string }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded px-2 py-1"
    >
      <option value="">—</option>
      {riders.map((r) => (
        <option key={r.id} value={r.id}>
          {r.bib ? `#${r.bib} ` : ''}{r.name} — {r.team}
        </option>
      ))}
    </select>
  );
}

export function FinalForm({
  editionId, initialGc, initialJersey, initialWhiteJersey, riders,
}: {
  editionId: string;
  initialGc: { first: string; second: string; third: string; fourth: string; fifth: string };
  initialJersey: string;
  initialWhiteJersey: string;
  riders: RiderOpt[];
}) {
  const [gc, setGc] = useState(initialGc);
  const [jersey, setJersey] = useState(initialJersey);
  const [whiteJersey, setWhiteJersey] = useState(initialWhiteJersey);
  const [status, setStatus] = useState<null | 'saving' | 'saved' | string>(null);
  const [pending, startTransition] = useTransition();

  const gcSlots = [gc.first, gc.second, gc.third, gc.fourth, gc.fifth];
  const gcValid = gcSlots.every(Boolean) && new Set(gcSlots).size === 5;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Final classifications</h1>
      <p className="text-sm text-muted-foreground">
        Set and publish GC top-5, points jersey winner, and white jersey winner. Each block is optional; publish what you have.
      </p>

      <section className="space-y-2">
        <h2 className="font-semibold">GC top 5</h2>
        <label className="block text-sm">1st place
          <RiderSelect id="first" value={gc.first} onChange={(v) => setGc({ ...gc, first: v })} riders={riders} />
        </label>
        <label className="block text-sm">2nd place
          <RiderSelect id="second" value={gc.second} onChange={(v) => setGc({ ...gc, second: v })} riders={riders} />
        </label>
        <label className="block text-sm">3rd place
          <RiderSelect id="third" value={gc.third} onChange={(v) => setGc({ ...gc, third: v })} riders={riders} />
        </label>
        <label className="block text-sm">4th place
          <RiderSelect id="fourth" value={gc.fourth} onChange={(v) => setGc({ ...gc, fourth: v })} riders={riders} />
        </label>
        <label className="block text-sm">5th place
          <RiderSelect id="fifth" value={gc.fifth} onChange={(v) => setGc({ ...gc, fifth: v })} riders={riders} />
        </label>
        {!gcValid && gcSlots.some(Boolean) && (
          <p className="text-xs text-red-600">All five slots need distinct riders to publish GC.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Points jersey winner</h2>
        <RiderSelect id="jersey" value={jersey} onChange={setJersey} riders={riders} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">White jersey winner</h2>
        <RiderSelect id="whiteJersey" value={whiteJersey} onChange={setWhiteJersey} riders={riders} />
      </section>

      <Button
        disabled={pending || (!gcValid && !jersey && !whiteJersey)}
        onClick={() => {
          setStatus('saving');
          startTransition(async () => {
            const res = await publishFinal({
              editionId,
              gc: gcValid ? gc : undefined,
              jerseyRiderId: jersey || undefined,
              whiteJerseyRiderId: whiteJersey || undefined,
            });
            setStatus(res.ok ? 'saved' : res.error);
          });
        }}
      >
        {pending ? 'Publishing\u2026' : 'Publish'}
      </Button>
      {status === 'saved' && <p className="text-sm text-green-600">Saved.</p>}
      {typeof status === 'string' && status !== 'saving' && status !== 'saved' && (
        <p className="text-sm text-red-600">{status}</p>
      )}
    </div>
  );
}
