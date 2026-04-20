'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
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
  const [savedRiderId, setSavedRiderId] = useState<string | null>(initialSelectedRiderId);
  const pendingRiderIdRef = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(
    submitStagePick,
    null as ActionResult<{ stagePickId: string }> | null,
  );

  // When the action resolves with ok=true, promote the pending rider to saved.
  useEffect(() => {
    if (state?.ok && pendingRiderIdRef.current) {
      setSavedRiderId(pendingRiderIdRef.current);
      pendingRiderIdRef.current = null;
    }
  }, [state]);

  const savedRider = riders.find((r) => r.id === savedRiderId);
  const selectedRider = riders.find((r) => r.id === selectedId);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stage {stageNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Locks {new Date(startTimeIso).toLocaleString()}
          {doublePoints && <Badge className="ml-2">2× points</Badge>}
        </p>
      </div>

      {savedRider && (
        <div className="rounded border border-green-200 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-sm">
          <span className="font-semibold text-green-700 dark:text-green-400">Current pick: </span>
          <span className="text-green-700 dark:text-green-400">{savedRider.name}</span>
        </div>
      )}

      <RiderPicker riders={riders} selectedId={selectedId} onSelect={setSelectedId} />

      <form action={formAction}>
        <input type="hidden" name="stageId" value={stageId} />
        <input type="hidden" name="riderId" value={selectedId ?? ''} />
        <Button
          type="submit"
          disabled={!selectedId || pending}
          className="w-full"
          onClick={() => {
            if (selectedId) pendingRiderIdRef.current = selectedId;
          }}
        >
          {pending ? 'Saving…' : 'Save pick'}
        </Button>
        {state && !state.ok && (
          <p className="text-sm text-red-600 mt-2">{state.error}</p>
        )}
      </form>

      {selectedRider && selectedRider.id !== savedRiderId && (
        <p className="text-xs text-muted-foreground">
          Selected: {selectedRider.name} — click Save pick to confirm.
        </p>
      )}
    </div>
  );
}
