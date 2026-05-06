'use client';

import Link from 'next/link';
import { useState, useActionState, useMemo } from 'react';
import { submitGcPicks } from '@/lib/actions/picks';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { RiderSearchInput, filterRidersByQuery } from '@/components/rider-search-input';
import { StickyActionBar } from '@/components/sticky-save-bar';
import { PageHeading } from '@/app/(app)/picks/page-heading';
import { Badge } from '@/components/design/badge';
import { Card } from '@/components/design/card';
import { DsButton } from '@/components/design/button';
import { TeamChip } from '@/components/design/team-chip';
import type { ActionResult } from '@/lib/actions/result';

type Rider = {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: 'active' | 'dnf' | 'dns';
};

type InitialPick = { position: number; rider: Rider };

const SLOT_LABELS = ['1st', '2nd', '3rd'] as const;
const SLOT_ORDINALS = ['first', 'second', 'third'] as const;

export function GcPickForm({
  editionId,
  riders: allRiders,
  initialPicks,
  isLocked,
}: {
  editionId: string;
  riders: Rider[];
  initialPicks: InitialPick[];
  isLocked: boolean;
}) {
  // picks[0] = 1st, picks[1] = 2nd, picks[2] = 3rd
  const initPickIds: [string | null, string | null, string | null] = [null, null, null];
  for (const p of initialPicks) {
    if (p.position >= 1 && p.position <= 3) {
      initPickIds[p.position - 1] = p.rider.id;
    }
  }

  const [picks, setPicks] = useState<[string | null, string | null, string | null]>(initPickIds);
  const [editingPos, setEditingPos] = useState<1 | 2 | 3 | null>(null);
  const [query, setQuery] = useState('');
  const [state, formAction, pending] = useActionState(submitGcPicks, null as ActionResult | null);

  const riderMap = useMemo(() => new Map(allRiders.map((r) => [r.id, r])), [allRiders]);

  // Saved state for dirty check
  const savedPicks = initPickIds;

  const allFilled = picks[0] !== null && picks[1] !== null && picks[2] !== null;
  const allDistinct = allFilled && new Set(picks).size === 3;
  const unchanged =
    picks[0] === savedPicks[0] && picks[1] === savedPicks[1] && picks[2] === savedPicks[2];
  const saveDisabled = isLocked || !allDistinct || unchanged || pending;

  function handleSlotClick(pos: 1 | 2 | 3) {
    if (isLocked) return;
    setEditingPos((prev) => (prev === pos ? null : pos));
    setQuery('');
  }

  function handlePickerSelect(riderId: string) {
    if (editingPos === null) return;
    const idx = editingPos - 1;
    setPicks((prev) => {
      const next: [string | null, string | null, string | null] = [...prev] as [
        string | null,
        string | null,
        string | null,
      ];
      next[idx] = riderId;
      return next;
    });
    setEditingPos(null);
  }

  // Riders available for the picker: filter out riders placed in OTHER slots, then by query.
  const pickerRiders: PickerRider[] = useMemo(() => {
    if (editingPos === null) return [];
    const slotFiltered = allRiders.filter((r) =>
      r.status === 'active' &&
      picks.every((p, i) => (i === editingPos - 1 ? true : p !== r.id)),
    );
    return filterRidersByQuery(slotFiltered, query);
  }, [allRiders, picks, editingPos, query]);

  const selectedForPicker = editingPos !== null ? picks[editingPos - 1] : null;

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
        title="GC Top 3"
        sub="50 pts exact position · 25 pts wrong-position podium · scored after final GC."
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

      {/* Three slot tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {([1, 2, 3] as const).map((pos) => {
          const idx = pos - 1;
          const riderId = picks[idx];
          const rider = riderId ? riderMap.get(riderId) : null;
          const isEditing = editingPos === pos;

          return (
            <button
              key={pos}
              disabled={isLocked}
              onClick={() => handleSlotClick(pos)}
              aria-label={`Edit ${SLOT_LABELS[idx]} place pick`}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isEditing ? 'var(--accent)' : 'var(--hair)'}`,
                borderRadius: 'var(--radius)',
                padding: 12,
                cursor: isLocked ? 'default' : 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minHeight: 90,
              }}
            >
              {/* Ordinal label */}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 28,
                  lineHeight: 1,
                  color: 'var(--accent)',
                }}
              >
                {SLOT_LABELS[idx]}
              </div>

              {rider ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TeamChip team={rider.team} size={12} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {rider.name.split(' ').slice(-1)[0]}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--ink-mute)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    BIB {rider.bib ?? '—'}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Tap to pick</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Inline picker */}
      {editingPos !== null && (
        <>
          <RiderSearchInput value={query} onChange={setQuery} />
          <RiderPicker
            riders={pickerRiders}
            selectedId={selectedForPicker}
            onSelect={handlePickerSelect}
            disableInactive={true}
            disableUsed={false}
          />
        </>
      )}

      {/* Scoring explainer */}
      <div
        style={{
          border: '1px dashed var(--hair)',
          borderRadius: 'var(--radius)',
          padding: 14,
          background: 'var(--surface-alt)',
          fontSize: 12,
          color: 'var(--ink-soft)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--ink)', fontSize: 13 }}>Scoring max 150 pts.</strong>
        <br />
        · 50 pts if your pick finishes at that exact position
        <br />
        · 25 pts if your pick finishes in the actual top 3 at a different position
        <br />
        · 0 pts otherwise
      </div>

      {/* Sticky save CTA */}
      <StickyActionBar>
        <form action={formAction}>
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name={SLOT_ORDINALS[0]} value={picks[0] ?? ''} />
          <input type="hidden" name={SLOT_ORDINALS[1]} value={picks[1] ?? ''} />
          <input type="hidden" name={SLOT_ORDINALS[2]} value={picks[2] ?? ''} />
          <DsButton variant="accent" size="lg" full type="submit" disabled={saveDisabled}>
            {pending ? 'Saving…' : 'Save GC picks'}
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
            {state.ok ? 'GC picks saved.' : state.error}
          </div>
        )}
      </StickyActionBar>
    </div>
  );
}
