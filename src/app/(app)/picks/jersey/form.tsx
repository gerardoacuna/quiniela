'use client';

import { useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { submitJerseyPick } from '@/lib/actions/picks';
import type { ActionResult } from '@/lib/actions/result';

export function JerseyPickForm({
  editionId,
  initialSelectedRiderId,
  riders,
}: {
  editionId: string;
  initialSelectedRiderId: string | null;
  riders: PickerRider[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedRiderId);
  const [state, formAction, pending] = useActionState(
    submitJerseyPick,
    null as ActionResult | null,
  );

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Points jersey</h1>
        <p className="text-sm text-muted-foreground">
          Pick the rider you think will win the final points classification.
          Locks when Stage 1 starts.
        </p>
      </div>

      <RiderPicker riders={riders} selectedId={selectedId} onSelect={setSelectedId} />

      <form action={formAction}>
        <input type="hidden" name="editionId" value={editionId} />
        <input type="hidden" name="riderId" value={selectedId ?? ''} />
        <Button type="submit" disabled={!selectedId || pending} className="w-full">
          {pending ? 'Saving…' : 'Save pick'}
        </Button>
        {state && (state.ok ? (
          <p className="text-sm text-green-600 mt-2">Jersey pick saved.</p>
        ) : (
          <p className="text-sm text-red-600 mt-2">{state.error}</p>
        ))}
      </form>
    </div>
  );
}
