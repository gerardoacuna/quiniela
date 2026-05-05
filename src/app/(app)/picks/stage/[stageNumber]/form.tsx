'use client';

import { useState, useActionState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { BibTile } from '@/components/design/bib-tile';
import { TeamChip } from '@/components/design/team-chip';
import { resolveTeam } from '@/components/design/teams';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { RiderSearchInput, filterRidersByQuery } from '@/components/rider-search-input';
import { StickyActionBar } from '@/components/sticky-save-bar';
import { submitStagePicks } from '@/lib/actions/picks';
import { StagePickHeader } from './stage-pick-header';
import type { ActionResult } from '@/lib/actions/result';

type Tab = 'primary' | 'hedge';

type FormRider = PickerRider & { is_top_tier: boolean };

export function StagePickForm({
  stageId,
  stageNumber,
  terrain,
  km,
  doublePoints,
  startTimeIso,
  initialPrimaryRiderId,
  initialHedgeRiderId,
  riders,
}: {
  stageId: string;
  stageNumber: number;
  terrain: string;
  km: number | null;
  doublePoints: boolean;
  startTimeIso: string;
  initialPrimaryRiderId: string | null;
  initialHedgeRiderId: string | null;
  riders: FormRider[];
}) {
  const [tab, setTab] = useState<Tab>('primary');
  const [primaryId, setPrimaryId] = useState<string | null>(initialPrimaryRiderId);
  const [hedgeId, setHedgeId] = useState<string | null>(initialHedgeRiderId);
  const [savedPrimaryId, setSavedPrimaryId] = useState<string | null>(initialPrimaryRiderId);
  const [savedHedgeId, setSavedHedgeId] = useState<string | null>(initialHedgeRiderId);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'available'>('all');

  function handleTab(next: Tab) {
    setTab(next);
    setQuery('');
  }

  const pendingSubmissionRef = useRef<{ primary: string | null; hedge: string | null } | null>(null);
  const [state, formAction, pending] = useActionState(
    submitStagePicks,
    null as ActionResult<{ stagePickId: string }> | null,
  );

  useEffect(() => {
    if (state?.ok && pendingSubmissionRef.current) {
      setSavedPrimaryId(pendingSubmissionRef.current.primary);
      setSavedHedgeId(pendingSubmissionRef.current.hedge);
      pendingSubmissionRef.current = null;
    }
  }, [state]);

  const ridersById = useMemo(() => new Map(riders.map((r) => [r.id, r])), [riders]);
  const savedPrimary = savedPrimaryId ? ridersById.get(savedPrimaryId) ?? null : null;
  const savedHedge = savedHedgeId ? ridersById.get(savedHedgeId) ?? null : null;
  const selectedPrimary = primaryId ? ridersById.get(primaryId) ?? null : null;

  // Picker source rows — kind-aware filtering before search.
  const pickerRiders: PickerRider[] = useMemo(() => {
    const base = riders.filter((r) => r.status === 'active');
    if (tab === 'primary') return base;
    return base
      .filter((r) => !r.is_top_tier)
      .map((r) =>
        r.id === primaryId
          ? { ...r, disabledReason: 'Already your primary on this stage' }
          : r,
      );
  }, [riders, tab, primaryId]);

  const tabSavedId = tab === 'primary' ? savedPrimaryId : savedHedgeId;
  const availableCount = pickerRiders.filter(
    (r) => r.usedOnStageNumber == null || r.id === tabSavedId,
  ).length;

  const filteredRiders =
    filter === 'available'
      ? pickerRiders.filter((r) => r.usedOnStageNumber == null || r.id === tabSavedId)
      : pickerRiders;

  const displayRiders = useMemo(
    () => filterRidersByQuery(filteredRiders, query),
    [filteredRiders, query],
  );

  const selectedId = tab === 'primary' ? primaryId : hedgeId;
  const setSelectedId = tab === 'primary' ? setPrimaryId : setHedgeId;

  const incompletePrimary = !primaryId;
  const dirty = primaryId !== savedPrimaryId || hedgeId !== savedHedgeId;
  const canSave = !incompletePrimary && dirty && !pending;

  function handleRemoveHedge() {
    setHedgeId(null);
  }

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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

      <StagePickHeader
        stageNumber={stageNumber}
        terrain={terrain}
        km={km}
        doublePoints={doublePoints}
        startTimeIso={startTimeIso}
      />

      {/* Current picks card — always shows both saved values when set. */}
      <div
        style={{
          background: 'var(--surface-alt)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <CurrentPickRow label="PRIMARY" rider={savedPrimary} />
        <CurrentPickRow label="HEDGE" rider={savedHedge} />
      </div>

      {/* Toggle */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
          padding: 4,
        }}
      >
        {(['primary', 'hedge'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => handleTab(t)}
              style={{
                padding: '8px 12px',
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--ink-soft)',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t === 'primary' ? 'Primary' : 'Hedge'}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
        {tab === 'primary'
          ? 'Top-10 finish scores 25/15/10/8/6/5/4/3/2/1.'
          : 'Same scoring. Hedge must be a non-top-tier rider; same rider cannot also be your primary on this stage.'}
      </div>

      {/* Search + filter chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RiderSearchInput value={query} onChange={setQuery} />
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { k: 'all', label: `All · ${pickerRiders.length}` },
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

      {/* Hedge tab "Remove hedge" affordance */}
      {tab === 'hedge' && hedgeId !== null && (
        <button
          type="button"
          onClick={handleRemoveHedge}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink-mute)',
            cursor: 'pointer',
            fontSize: 12,
            padding: 4,
            alignSelf: 'flex-start',
          }}
        >
          × Remove hedge
        </button>
      )}

      {/* Sticky save */}
      <StickyActionBar style={{ borderTop: '1px solid var(--hair)' }}>
        {selectedPrimary && primaryId !== savedPrimaryId && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <TeamChip team={selectedPrimary.team} size={10} />
            Save <strong style={{ color: 'var(--ink)' }}>{selectedPrimary.name}</strong> as primary for Stage{' '}
            {stageNumber}
          </div>
        )}

        <form action={formAction}>
          <input type="hidden" name="stageId" value={stageId} />
          <input type="hidden" name="primaryRiderId" value={primaryId ?? ''} />
          <input type="hidden" name="hedgeRiderId" value={hedgeId ?? ''} />
          <button
            type="submit"
            disabled={!canSave}
            onClick={() => {
              if (canSave) pendingSubmissionRef.current = { primary: primaryId, hedge: hedgeId };
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
            {pending ? 'Saving…' : !dirty ? 'Picks saved ✓' : 'Save picks'}
          </button>
          {state && !state.ok && (
            <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 8 }}>{state.error}</p>
          )}
        </form>
      </StickyActionBar>
    </div>
  );
}

function CurrentPickRow({ label, rider }: { label: string; rider: FormRider | null }) {
  if (!rider) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.55 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.4,
            color: 'var(--ink-mute)',
            width: 64,
          }}
        >
          {label}
        </span>
        <BibTile num={null} size={26} />
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>No pick</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ink-mute)',
          width: 64,
        }}
      >
        {label}
      </span>
      <BibTile num={rider.bib} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{rider.name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamChip team={rider.team} size={10} />
          {resolveTeam(rider.team).name}
        </div>
      </div>
    </div>
  );
}
