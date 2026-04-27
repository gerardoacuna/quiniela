'use server';

import { z } from 'zod';
import { requireProfile } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { validateNoReuse, type ExistingPick } from '@/lib/picks/no-reuse';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { ActionResult } from './result';

type Supa = SupabaseClient<Database>;

const submitStagePickSchema = z.object({
  stageId: z.string().uuid(),
  riderId: z.string().uuid(),
});

export async function submitStagePickCore(
  supabase: Supa,
  userId: string,
  input: { stageId: string; riderId: string },
): Promise<ActionResult<{ stagePickId: string }>> {
  // 1. Load stage.
  const { data: stage, error: stageErr } = await supabase
    .from('stages')
    .select('id, edition_id, number, start_time, status, counts_for_scoring')
    .eq('id', input.stageId)
    .maybeSingle();
  if (stageErr) return { ok: false, error: stageErr.message };
  if (!stage) return { ok: false, error: 'stage_not_found' };
  if (new Date(stage.start_time).getTime() <= Date.now()) {
    return { ok: false, error: 'stage_locked' };
  }
  if (stage.status === 'cancelled') return { ok: false, error: 'stage_cancelled' };

  // 2. Load rider.
  const { data: rider, error: riderErr } = await supabase
    .from('riders')
    .select('id, edition_id, status')
    .eq('id', input.riderId)
    .maybeSingle();
  if (riderErr) return { ok: false, error: riderErr.message };
  if (!rider) return { ok: false, error: 'rider_not_found' };
  if (rider.edition_id !== stage.edition_id) return { ok: false, error: 'rider_wrong_edition' };
  if (rider.status !== 'active') return { ok: false, error: 'rider_not_active' };

  // 3. No-reuse check.
  const { data: existing, error: exErr } = await supabase
    .from('stage_picks')
    .select('stage_id, rider_id, stages!inner(edition_id, number, status)')
    .eq('user_id', userId)
    .eq('stages.edition_id', stage.edition_id);
  if (exErr) return { ok: false, error: exErr.message };

  type ExistingRow = { stage_id: string; rider_id: string; stages: { edition_id: string; number: number; status: string } };
  const normalized: ExistingPick[] = (existing ?? []).map((p) => {
    const row = p as unknown as ExistingRow;
    return {
      stage_id: row.stage_id,
      rider_id: row.rider_id,
      stage_status: row.stages.status as ExistingPick['stage_status'],
      stage_number: row.stages.number,
    };
  });

  const reuseCheck = validateNoReuse(normalized, input.stageId, input.riderId);
  if (!reuseCheck.ok) {
    return { ok: false, error: `rider_already_used_on_stage_${reuseCheck.conflictingStageNumber}` };
  }

  // 4. Upsert.
  const { data: upserted, error: upErr } = await supabase
    .from('stage_picks')
    .upsert(
      { user_id: userId, stage_id: input.stageId, rider_id: input.riderId },
      { onConflict: 'user_id,stage_id' },
    )
    .select('id')
    .single();
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, data: { stagePickId: upserted.id } };
}

export async function submitStagePick(
  _prev: ActionResult<{ stagePickId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ stagePickId: string }>> {
  const parsed = submitStagePickSchema.safeParse({
    stageId: formData.get('stageId'),
    riderId: formData.get('riderId'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };

  const { user } = await requireProfile();
  const supabase = await createClient();
  return submitStagePickCore(supabase, user.id, parsed.data);
}

const submitGcPicksSchema = z.object({
  editionId: z.string().uuid(),
  first: z.string().uuid(),
  second: z.string().uuid(),
  third: z.string().uuid(),
});

export async function submitGcPicksCore(
  supabase: Supa,
  userId: string,
  input: { editionId: string; first: string; second: string; third: string },
): Promise<ActionResult> {
  const slots = [input.first, input.second, input.third];
  if (new Set(slots).size !== 3) return { ok: false, error: 'gc_riders_must_be_distinct' };

  const { data: stage1, error: s1Err } = await supabase
    .from('stages')
    .select('start_time')
    .eq('edition_id', input.editionId)
    .eq('number', 1)
    .maybeSingle();
  if (s1Err) return { ok: false, error: s1Err.message };
  if (!stage1) return { ok: false, error: 'edition_missing_stage_1' };
  if (new Date(stage1.start_time).getTime() <= Date.now()) return { ok: false, error: 'gc_locked' };

  const { data: riders, error: rErr } = await supabase
    .from('riders')
    .select('id, edition_id, status')
    .in('id', slots);
  if (rErr) return { ok: false, error: rErr.message };
  if (!riders || riders.length !== 3) return { ok: false, error: 'rider_not_found' };
  for (const r of riders) {
    if (r.edition_id !== input.editionId) return { ok: false, error: 'rider_wrong_edition' };
    if (r.status !== 'active') return { ok: false, error: 'rider_not_active' };
  }

  const rows = [
    { user_id: userId, edition_id: input.editionId, position: 1, rider_id: input.first },
    { user_id: userId, edition_id: input.editionId, position: 2, rider_id: input.second },
    { user_id: userId, edition_id: input.editionId, position: 3, rider_id: input.third },
  ];
  const { error } = await supabase
    .from('gc_picks')
    .upsert(rows, { onConflict: 'user_id,edition_id,position' });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

export async function submitGcPicks(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submitGcPicksSchema.safeParse({
    editionId: formData.get('editionId'),
    first: formData.get('first'),
    second: formData.get('second'),
    third: formData.get('third'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };

  const { user } = await requireProfile();
  const supabase = await createClient();
  return submitGcPicksCore(supabase, user.id, parsed.data);
}

const submitJerseyPickSchema = z.object({
  editionId: z.string().uuid(),
  riderId: z.string().uuid(),
});

export async function submitJerseyPickCore(
  supabase: Supa,
  userId: string,
  input: { editionId: string; riderId: string },
): Promise<ActionResult> {
  const { data: stage1, error: s1Err } = await supabase
    .from('stages')
    .select('start_time')
    .eq('edition_id', input.editionId)
    .eq('number', 1)
    .maybeSingle();
  if (s1Err) return { ok: false, error: s1Err.message };
  if (!stage1) return { ok: false, error: 'edition_missing_stage_1' };
  if (new Date(stage1.start_time).getTime() <= Date.now()) return { ok: false, error: 'jersey_locked' };

  const { data: rider, error: rErr } = await supabase
    .from('riders')
    .select('id, edition_id, status')
    .eq('id', input.riderId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!rider) return { ok: false, error: 'rider_not_found' };
  if (rider.edition_id !== input.editionId) return { ok: false, error: 'rider_wrong_edition' };
  if (rider.status !== 'active') return { ok: false, error: 'rider_not_active' };

  const { error } = await supabase
    .from('jersey_picks')
    .upsert(
      { user_id: userId, edition_id: input.editionId, kind: 'points', rider_id: input.riderId },
      { onConflict: 'user_id,edition_id,kind' },
    );
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

export async function submitJerseyPick(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submitJerseyPickSchema.safeParse({
    editionId: formData.get('editionId'),
    riderId: formData.get('riderId'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };

  const { user } = await requireProfile();
  const supabase = await createClient();
  return submitJerseyPickCore(supabase, user.id, parsed.data);
}
