'use client';

import Link from 'next/link';
import { useState, useActionState } from 'react';
import { submitJerseyPicks } from '@/lib/actions/picks';
import { RiderPicker } from '@/components/rider-picker';
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

function PickerCard({
  kind,
  label,
  selectedRider,
  onSelect,
  selectedId,
  riders,
  isLocked,
}: {
  kind: 'points' | 'white';
  label: string;
  selectedRider: Rider | null;
  onSelect: (id: string) => void;
  selectedId: string | null;
  riders: Rider[];
  isLocked: boolean;
}) {
  return (
    <Card>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: 1.4,
        color: 'var(--ink-mute)',
        textTransform: 'uppercase',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <JerseyGlyph kind={kind} size={14} />
        {label}
      </div>

      {selectedRider ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <BibTile num={selectedRider.bib} size={36} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedRider.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{selectedRider.team ?? '—'}</div>
          </div>
        </div>
      ) : (
        <div
          style={{
            border: '1px dashed var(--hair)',
            borderRadius: 'var(--radius)',
            padding: 14,
            textAlign: 'center',
            color: 'var(--ink-mute)',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          No rider selected yet
        </div>
      )}

      {!isLocked && (
        <RiderPicker
          riders={riders}
          selectedId={selectedId}
          onSelect={onSelect}
          disableInactive={true}
          disableUsed={false}
        />
      )}
    </Card>
  );
}

export function JerseysPickForm({
  editionId,
  riders,
  initialPoints,
  initialWhite,
  isLocked,
}: {
  editionId: string;
  riders: Rider[];
  initialPoints: Rider | null;
  initialWhite: Rider | null;
  isLocked: boolean;
}) {
  const [pointsId, setPointsId] = useState<string | null>(initialPoints?.id ?? null);
  const [whiteId, setWhiteId] = useState<string | null>(initialWhite?.id ?? null);
  const [state, formAction, pending] = useActionState(submitJerseyPicks, null as ActionResult | null);

  const savedPoints = initialPoints?.id ?? null;
  const savedWhite = initialWhite?.id ?? null;
  const unchanged = pointsId === savedPoints && whiteId === savedWhite;
  const incomplete = !pointsId || !whiteId;
  const saveDisabled = isLocked || incomplete || unchanged || pending;

  const pointsRider = pointsId ? riders.find((r) => r.id === pointsId) ?? null : null;
  const whiteRider = whiteId ? riders.find((r) => r.id === whiteId) ?? null : null;

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
        title="Jerseys"
        sub="50 pts each if correct · 0 otherwise."
      />

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

      <PickerCard
        kind="points"
        label="Points jersey"
        selectedRider={pointsRider}
        onSelect={setPointsId}
        selectedId={pointsId}
        riders={riders}
        isLocked={isLocked}
      />

      <PickerCard
        kind="white"
        label="White jersey"
        selectedRider={whiteRider}
        onSelect={setWhiteId}
        selectedId={whiteId}
        riders={riders}
        isLocked={isLocked}
      />

      <div style={{ position: 'sticky', bottom: 16 }}>
        <form action={formAction}>
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name="pointsRiderId" value={pointsId ?? ''} />
          <input type="hidden" name="whiteRiderId" value={whiteId ?? ''} />
          <DsButton variant="accent" size="lg" full type="submit" disabled={saveDisabled}>
            {pending ? 'Saving…' : 'Save jersey picks'}
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
            {state.ok ? 'Jersey picks saved.' : state.error}
          </div>
        )}
      </div>
    </div>
  );
}
