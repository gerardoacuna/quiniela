'use client';

import Link from 'next/link';
import { useMemo, useState, useActionState } from 'react';
import { submitJerseyPick } from '@/lib/actions/picks';
import { RiderPicker } from '@/components/rider-picker';
import { RiderSearchInput, filterRidersByQuery } from '@/components/rider-search-input';
import { StickyActionBar } from '@/components/sticky-save-bar';
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

const KIND_LABEL: Record<'points' | 'white', string> = {
  points: 'Points jersey',
  white: 'White jersey',
};

export function JerseyKindPickForm({
  editionId,
  kind,
  riders,
  initialRider,
  isLocked,
}: {
  editionId: string;
  kind: 'points' | 'white';
  riders: Rider[];
  initialRider: Rider | null;
  isLocked: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialRider?.id ?? null);
  const [query, setQuery] = useState('');
  const [state, formAction, pending] = useActionState(submitJerseyPick, null as ActionResult | null);

  const savedId = initialRider?.id ?? null;
  const incomplete = !selectedId;
  const unchanged = selectedId === savedId;
  const saveDisabled = isLocked || incomplete || unchanged || pending;

  const selectedRider = selectedId ? riders.find((r) => r.id === selectedId) ?? null : null;
  const displayRiders = useMemo(() => filterRidersByQuery(riders, query), [riders, query]);

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
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        ← Picks
      </Link>

      <PageHeading
        eyebrow="Pre-race"
        title={KIND_LABEL[kind]}
        sub="25 pts if correct · 0 otherwise."
      />

      {isLocked && (
        <Card style={{ background: 'var(--surface-alt)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge tone="muted">Locked since Stage 1</Badge>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Your pick is visible to other players.
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.4,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <JerseyGlyph kind={kind} size={14} />
          Current pick
        </div>

        {selectedRider ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            }}
          >
            No rider selected yet
          </div>
        )}
      </Card>

      {!isLocked && (
        <>
          <RiderSearchInput value={query} onChange={setQuery} />
          <RiderPicker
            riders={displayRiders}
            selectedId={selectedId}
            onSelect={setSelectedId}
            disableInactive={true}
            disableUsed={false}
          />
        </>
      )}

      <StickyActionBar>
        <form action={formAction}>
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="riderId" value={selectedId ?? ''} />
          <DsButton variant="accent" size="lg" full type="submit" disabled={saveDisabled}>
            {pending ? 'Saving…' : `Save ${KIND_LABEL[kind].toLowerCase()}`}
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
            {state.ok ? 'Pick saved.' : state.error}
          </div>
        )}
      </StickyActionBar>
    </div>
  );
}
