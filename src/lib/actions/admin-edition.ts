'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './result';

const stageFlagsSchema = z.object({
  editionId: z.string().uuid(),
  stages: z.array(z.object({
    id: z.string().uuid(),
    counts_for_scoring: z.boolean(),
    double_points: z.boolean(),
    terrain: z.enum(['flat', 'hilly', 'mountain', 'itt']),
    km: z.number().int().min(0).max(400),
  })),
});

export async function updateStageFlags(input: z.infer<typeof stageFlagsSchema>): Promise<ActionResult> {
  const parsed = stageFlagsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const { user } = await requireAdmin();
  const supabase = await createClient();

  for (const s of parsed.data.stages) {
    const { error } = await supabase
      .from('stages')
      .update({
        counts_for_scoring: s.counts_for_scoring,
        double_points: s.double_points,
        terrain: s.terrain,
        km: s.km,
      })
      .eq('id', s.id)
      .eq('edition_id', parsed.data.editionId);
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'update_edition_stage_flags',
    target: { editionId: parsed.data.editionId, stageCount: parsed.data.stages.length },
  });

  return { ok: true, data: undefined };
}
