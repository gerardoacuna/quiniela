'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BibTile } from '@/components/design/bib-tile';
import { TeamChip } from '@/components/design/team-chip';
import { resolveTeam } from '@/components/design/teams';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { submitStagePick } from '@/lib/actions/picks';
import { StagePickHeader } from './stage-pick-header';
import type { ActionResult } from '@/lib/actions/result';

export function StagePickForm({
  stageId,
  stageNumber,
  terrain,
  km,
  doublePoints,
  startTimeIso,
  initialSelectedRiderId,
  riders,
}: {
  stageId: string;
  stageNumber: number;
  terrain: string;
  km: number | null;
  doublePoints: boolean;
  startTimeIso: string;
  initialSelectedRiderId: string | null;
  riders: PickerRider[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedRiderId);
  const [savedRiderId, setSavedRiderId] = useState<string | null>(initialSelectedRiderId);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'available'>('all');
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

  const isUsedElsewhere =
    selectedId != null &&
    selectedRider?.usedOnStageNumber != null &&
    selectedId !== savedRiderId;

  const canSave = Boolean(selectedId) && !pending && selectedId !== savedRiderId && !isUsedElsewhere;

  // Compute available count
  const availableCount = riders.filter(
    (r) => r.status === 'active' && (r.usedOnStageNumber == null || r.id === savedRiderId),
  ).length;

  // Filter riders
  const filteredRiders = riders.filter((r) => {
    if (filter === 'available') {
      return r.status === 'active' && (r.usedOnStageNumber == null || r.id === savedRiderId);
    }
    return true;
  });

  // Search within filtered
  const q = query.trim().toLowerCase();
  const displayRiders = q
    ? filteredRiders.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.team ?? '').toLowerCase().includes(q) ||
          (r.bib != null && String(r.bib).includes(q)),
      )
    : filteredRiders;

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Back link */}
      <Link
        href="/picks"
        style={{
          background: 'none',
          color: 'var(--ink-soft)',
          padding: '6px 0',
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          textDecoration: 'none',
        }}
      >
        ← Picks
      </Link>

      {/* Stage pick header */}
      <StagePickHeader
        stageNumber={stageNumber}
        terrain={terrain}
        km={km}
        doublePoints={doublePoints}
        startTimeIso={startTimeIso}
      />

      {/* Current pick summary */}
      <div
        style={{
          background: savedRider ? 'var(--accent-soft)' : 'var(--surface-alt)',
          border: `1px solid ${savedRider ? 'var(--accent)' : 'var(--hair)'}`,
          borderRadius: 'var(--radius)',
          padding: 12,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.2,
            color: savedRider ? 'var(--accent)' : 'var(--ink-mute)',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {savedRider ? 'Current pick' : 'No rider picked'}
        </div>
        {savedRider ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <BibTile num={savedRider.bib} size={30} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{savedRider.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <TeamChip team={savedRider.team} size={10} />
                {resolveTeam(savedRider.team).name}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Editable until lock</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            Choose any active rider below. Riders already used on another counted stage are greyed out.
          </div>
        )}
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-mute)"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M16 16 L21 21" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, team, bib…"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--ink)',
              flex: 1,
              fontSize: 14,
              fontFamily: 'var(--font-body)',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-mute)',
                cursor: 'pointer',
                fontSize: 16,
                padding: 0,
                lineHeight: 1,
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { k: 'all', label: `All · ${riders.length}` },
            { k: 'available', label: `Available · ${availableCount}` },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k as 'all' | 'available')}
              style={{
                background: filter === f.k ? 'var(--ink)' : 'transparent',
                color: filter === f.k ? 'var(--bg)' : 'var(--ink-soft)',
                border: `1px solid ${filter === f.k ? 'var(--ink)' : 'var(--hair)'}`,
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                flex: 'none',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rider list */}
      <RiderPicker
        riders={displayRiders}
        selectedId={selectedId}
        onSelect={setSelectedId}
        disableUsed={true}
        disableInactive={true}
      />

      {/* Sticky save CTA */}
      <div
        style={{
          position: 'sticky',
          bottom: 74,
          background: 'var(--bg)',
          borderTop: '1px solid var(--hair)',
          padding: '10px 0 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 4,
        }}
      >
        {selectedRider && selectedId !== savedRiderId && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <TeamChip team={selectedRider.team} size={10} />
            Save <strong style={{ color: 'var(--ink)' }}>{selectedRider.name}</strong> for Stage{' '}
            {stageNumber}
          </div>
        )}
        <form action={formAction}>
          <input type="hidden" name="stageId" value={stageId} />
          <input type="hidden" name="riderId" value={selectedId ?? ''} />
          <button
            type="submit"
            disabled={!canSave}
            onClick={() => {
              if (selectedId) pendingRiderIdRef.current = selectedId;
            }}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: canSave ? 'var(--accent)' : 'var(--hair)',
              color: canSave ? 'var(--accent-ink)' : 'var(--ink-mute)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: 15,
              fontWeight: 700,
              cursor: canSave ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {pending ? 'Saving…' : selectedId === savedRiderId ? 'Pick saved ✓' : 'Save pick'}
          </button>
          {state && !state.ok && (
            <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 8 }}>{state.error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
