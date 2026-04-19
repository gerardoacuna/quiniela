'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { ActionResult } from './result';

type Supa = SupabaseClient<Database>;

const publishSchema = z.object({
  stageId: z.string().uuid(),
  results: z.array(z.object({
    position: z.number().int().min(1).max(10),
    rider_id: z.string().uuid(),
  })).min(1).max(10),
});

export async function publishStageResultsCore(
  supabase: Supa,
  actorId: string,
  input: z.infer<typeof publishSchema>,
): Promise<ActionResult> {
  // Verify positions are unique and contiguous from 1.
  const positions = input.results.map((r) => r.position).sort((a, b) => a - b);
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== i + 1) return { ok: false, error: `missing_or_duplicate_position_${i + 1}` };
  }

  const { error: delErr } = await supabase.from('stage_results').delete().eq('stage_id', input.stageId);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = input.results.map((r) => ({
    stage_id: input.stageId,
    position: r.position,
    rider_id: r.rider_id,
    status: 'published' as const,
  }));
  const { error: insErr } = await supabase.from('stage_results').insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  const { error: stageErr } = await supabase
    .from('stages').update({ status: 'published' }).eq('id', input.stageId);
  if (stageErr) return { ok: false, error: stageErr.message };

  await supabase.from('audit_log').insert({
    actor_id: actorId,
    action: 'publish_stage_results',
    target: { stageId: input.stageId, top_count: rows.length },
  });

  return { ok: true, data: undefined };
}

export async function publishStageResults(input: z.infer<typeof publishSchema>): Promise<ActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  const { user } = await requireAdmin();
  const supabase = await createClient();
  return publishStageResultsCore(supabase, user.id, parsed.data);
}

export async function cancelStageCore(
  supabase: Supa,
  actorId: string,
  stageId: string,
): Promise<ActionResult> {
  const { data: stage, error: loadErr } = await supabase
    .from('stages').select('status').eq('id', stageId).maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message };
  if (!stage) return { ok: false, error: 'stage_not_found' };
  if (stage.status === 'published') return { ok: false, error: 'stage_already_published' };

  const { error } = await supabase
    .from('stages').update({ status: 'cancelled' }).eq('id', stageId);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: actorId,
    action: 'cancel_stage',
    target: { stageId },
  });

  return { ok: true, data: undefined };
}

export async function cancelStage(stageId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(stageId);
  if (!parsed.success) return { ok: false, error: 'invalid_stage_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();
  return cancelStageCore(supabase, user.id, parsed.data);
}

export async function resetStageToUpcomingCore(
  supabase: Supa,
  actorId: string,
  stageId: string,
): Promise<ActionResult> {
  const { data: stage, error: loadErr } = await supabase
    .from('stages').select('status').eq('id', stageId).maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message };
  if (!stage) return { ok: false, error: 'stage_not_found' };
  if (stage.status === 'published') return { ok: false, error: 'stage_already_published' };

  const { error: delErr } = await supabase.from('stage_results').delete().eq('stage_id', stageId);
  if (delErr) return { ok: false, error: delErr.message };

  const { error } = await supabase
    .from('stages').update({ status: 'upcoming' }).eq('id', stageId);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: actorId,
    action: 'reset_stage',
    target: { stageId },
  });

  return { ok: true, data: undefined };
}

export async function resetStageToUpcoming(stageId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(stageId);
  if (!parsed.success) return { ok: false, error: 'invalid_stage_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();
  return resetStageToUpcomingCore(supabase, user.id, parsed.data);
}
