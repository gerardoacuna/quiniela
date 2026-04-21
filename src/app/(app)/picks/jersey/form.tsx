'use client';

import Link from 'next/link';
import { useState, useActionState } from 'react';
import { submitJerseyPick } from '@/lib/actions/picks';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { PageHeading } from '@/app/(app)/picks/page-heading';
import { Badge } from '@/components/design/badge';
import { Card } from '@/components/design/card';
import { DsButton } from '@/components/design/button';
import { BibTile } from '@/components/design/bib-tile';
import { JerseyGlyph } from '@/components/design/jersey-glyph';
import type { ActionResult } from '@/lib/actions/result';

type Rider = {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: 'active' | 'dnf' | 'dns';
};

export function JerseyPickForm({
  editionId,
  riders: allRiders,
  initialRider,
  isLocked,
}: {
  editionId: string;
  riders: Rider[];
  initialRider: Rider | null;
  isLocked: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialRider?.id ?? null);
  const [state, formAction, pending] = useActionState(submitJerseyPick, null as ActionResult | null);

  const savedId = initialRider?.id ?? null;
  const unchanged = selectedId === savedId;
  const saveDisabled = isLocked || !selectedId || unchanged || pending;

  const pickerRiders: PickerRider[] = allRiders;

  const selectedRider = selectedId ? allRiders.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Back link */}
      <Link
        href="/picks"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--ink-soft)',
          padding: '6px 0',
          fontSize: 13,
          cursor: 'pointer',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        ← Picks
      </Link>

      <PageHeading
        eyebrow="Pre-race"
        title="Points jersey"
        sub="30 pts if correct · 0 otherwise."
      />

      {/* Locked notice */}
      {isLocked && (
        <Card style={{ background: 'var(--surface-alt)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge tone="muted">Locked since Stage 1</Badge>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Your picks are visible to other players.
            </div>
          </div>
        </Card>
      )}

      {/* Current pick summary card */}
      {selectedRider ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <JerseyGlyph />
            <BibTile num={selectedRider.bib} size={36} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedRider.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                {selectedRider.team ?? '—'}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div
          style={{
            border: '1px dashed var(--hair)',
            borderRadius: 'var(--radius)',
            padding: 16,
            textAlign: 'center',
            color: 'var(--ink-mute)',
            fontSize: 13,
          }}
        >
          No rider selected yet
        </div>
      )}

      {/* Rider picker */}
      {!isLocked && (
        <RiderPicker
          riders={pickerRiders}
          selectedId={selectedId}
          onSelect={setSelectedId}
          disableInactive={true}
          disableUsed={false}
        />
      )}

      {/* Sticky save CTA */}
      <div style={{ position: 'sticky', bottom: 16 }}>
        <form action={formAction}>
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name="riderId" value={selectedId ?? ''} />
          <DsButton variant="accent" size="lg" full type="submit" disabled={saveDisabled}>
            {pending ? 'Saving…' : 'Save jersey pick'}
          </DsButton>
        </form>

        {state && (
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: state.ok ? 'var(--ok)' : 'var(--danger)',
              textAlign: 'center',
            }}
          >
            {state.ok ? 'Jersey pick saved.' : state.error}
          </div>
        )}
      </div>
    </div>
  );
}
