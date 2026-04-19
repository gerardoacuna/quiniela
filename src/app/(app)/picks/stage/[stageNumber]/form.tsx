'use client';

import { useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { submitStagePick } from '@/lib/actions/picks';
import type { ActionResult } from '@/lib/actions/result';

export function StagePickForm({
  stageId,
  stageNumber,
  doublePoints,
  startTimeIso,
  initialSelectedRiderId,
  riders,
}: {
  stageId: string;
  stageNumber: number;
  doublePoints: boolean;
  startTimeIso: string;
  initialSelectedRiderId: string | null;
  riders: PickerRider[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedRiderId);
  const [state, formAction, pending] = useActionState(
    submitStagePick,
    null as ActionResult<{ stagePickId: string }> | null,
  );

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stage {stageNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Locks {new Date(startTimeIso).toLocaleString()}
          {doublePoints && <Badge className="ml-2">2× points</Badge>}
        </p>
      </div>

      <RiderPicker riders={riders} selectedId={selectedId} onSelect={setSelectedId} />

      <form action={formAction}>
        <input type="hidden" name="stageId" value={stageId} />
        <input type="hidden" name="riderId" value={selectedId ?? ''} />
        <Button type="submit" disabled={!selectedId || pending} className="w-full">
          {pending ? 'Saving…' : 'Save pick'}
        </Button>
        {state && (state.ok ? (
          <p className="text-sm text-green-600 mt-2">Pick saved.</p>
        ) : (
          <p className="text-sm text-red-600 mt-2">{state.error}</p>
        ))}
      </form>
    </div>
  );
}
