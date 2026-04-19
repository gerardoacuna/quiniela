'use client';

import { useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { submitGcPicks } from '@/lib/actions/picks';
import type { ActionResult } from '@/lib/actions/result';

type Selection = { first: string | null; second: string | null; third: string | null };

export function GcPickForm({
  editionId,
  initial,
  riders,
}: {
  editionId: string;
  initial: Selection;
  riders: PickerRider[];
}) {
  const [sel, setSel] = useState<Selection>(initial);
  const [state, formAction, pending] = useActionState(
    submitGcPicks,
    null as ActionResult | null,
  );

  // Mark a rider as "used" in the other two slots (so the picker disables it).
  function ridersFor(slot: keyof Selection): PickerRider[] {
    const otherSlots = (['first', 'second', 'third'] as const).filter((s) => s !== slot);
    const usedIds = new Set(otherSlots.map((s) => sel[s]).filter((v): v is string => !!v));
    return riders.map((r) => ({
      ...r,
      // Reuse the existing "usedOnStageNumber" marker by piggybacking a sentinel (99 = another GC slot).
      // Display the badge via a separate data source if you want nicer text; for MVP this is fine.
      usedOnStageNumber: usedIds.has(r.id) ? 99 : undefined,
    }));
  }

  const allSelected = sel.first && sel.second && sel.third;
  const allDistinct = allSelected && new Set([sel.first, sel.second, sel.third]).size === 3;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GC top 3</h1>
        <p className="text-sm text-muted-foreground">
          Pick the three riders you think will finish 1st, 2nd, and 3rd overall.
          All three picks lock when Stage 1 starts.
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-2">1st place</h2>
        <RiderPicker
          riders={ridersFor('first')}
          selectedId={sel.first}
          onSelect={(id) => setSel((s) => ({ ...s, first: id }))}
        />
      </section>

      <section>
        <h2 className="font-semibold mb-2">2nd place</h2>
        <RiderPicker
          riders={ridersFor('second')}
          selectedId={sel.second}
          onSelect={(id) => setSel((s) => ({ ...s, second: id }))}
        />
      </section>

      <section>
        <h2 className="font-semibold mb-2">3rd place</h2>
        <RiderPicker
          riders={ridersFor('third')}
          selectedId={sel.third}
          onSelect={(id) => setSel((s) => ({ ...s, third: id }))}
        />
      </section>

      <form action={formAction}>
        <input type="hidden" name="editionId" value={editionId} />
        <input type="hidden" name="first" value={sel.first ?? ''} />
        <input type="hidden" name="second" value={sel.second ?? ''} />
        <input type="hidden" name="third" value={sel.third ?? ''} />
        <Button
          type="submit"
          disabled={!allDistinct || pending}
          className="w-full"
        >
          {pending ? 'Saving…' : 'Save GC picks'}
        </Button>
        {state && (state.ok ? (
          <p className="text-sm text-green-600 mt-2">GC picks saved.</p>
        ) : (
          <p className="text-sm text-red-600 mt-2">{state.error}</p>
        ))}
      </form>
    </div>
  );
}
