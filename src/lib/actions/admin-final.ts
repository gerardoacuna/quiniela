'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { ActionResult } from './result';

type Supa = SupabaseClient<Database>;

const publishFinalSchema = z.object({
  editionId: z.string().uuid(),
  gc: z.object({
    first: z.string().uuid(),
    second: z.string().uuid(),
    third: z.string().uuid(),
  }).optional(),
  jerseyRiderId: z.string().uuid().optional(),
});

export async function publishFinalCore(
  supabase: Supa,
  actorId: string,
  input: z.infer<typeof publishFinalSchema>,
): Promise<ActionResult> {
  if (!input.gc && !input.jerseyRiderId) {
    return { ok: false, error: 'nothing_to_publish' };
  }

  if (input.gc) {
    const ids = [input.gc.first, input.gc.second, input.gc.third];
    if (new Set(ids).size !== 3) return { ok: false, error: 'gc_riders_must_be_distinct' };

    await supabase.from('final_classifications').delete()
      .eq('edition_id', input.editionId).eq('kind', 'gc');
    const { error } = await supabase.from('final_classifications').insert([
      { edition_id: input.editionId, kind: 'gc', position: 1, rider_id: input.gc.first,  status: 'published' },
      { edition_id: input.editionId, kind: 'gc', position: 2, rider_id: input.gc.second, status: 'published' },
      { edition_id: input.editionId, kind: 'gc', position: 3, rider_id: input.gc.third,  status: 'published' },
    ]);
    if (error) return { ok: false, error: error.message };
  }

  if (input.jerseyRiderId) {
    await supabase.from('final_classifications').delete()
      .eq('edition_id', input.editionId).eq('kind', 'points_jersey');
    const { error } = await supabase.from('final_classifications').insert({
      edition_id: input.editionId, kind: 'points_jersey', position: 1,
      rider_id: input.jerseyRiderId, status: 'published',
    });
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_id: actorId,
    action: 'publish_final_classifications',
    target: {
      editionId: input.editionId,
      gc: input.gc ? true : false,
      jersey: input.jerseyRiderId ? true : false,
    },
  });

  return { ok: true, data: undefined };
}

export async function publishFinal(input: z.infer<typeof publishFinalSchema>): Promise<ActionResult> {
  const parsed = publishFinalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  const { user } = await requireAdmin();
  const supabase = await createClient();
  return publishFinalCore(supabase, user.id, parsed.data);
}
