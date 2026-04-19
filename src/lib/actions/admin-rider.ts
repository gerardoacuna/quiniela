'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { pcsStartlistUrl } from '@/lib/pcs/urls';
import { parseStartlist } from '@/lib/pcs/parse-startlist';
import type { ActionResult } from './result';

const refreshSchema = z.object({
  editionId: z.string().uuid(),
  raceSlug: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
});

export async function upsertRidersFromStartlist(
  input: z.infer<typeof refreshSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = refreshSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const { user } = await requireAdmin();
  const url = pcsStartlistUrl(parsed.data.raceSlug, parsed.data.year);

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': process.env.PCS_USER_AGENT ?? 'Quiniela' },
    });
    if (!res.ok) return { ok: false, error: `pcs_fetch_${res.status}` };
    html = await res.text();
  } catch (e) {
    return { ok: false, error: `fetch_${(e as Error).message}` };
  }

  let entries;
  try {
    entries = parseStartlist(html);
  } catch (e) {
    return { ok: false, error: `parse_${(e as Error).message}` };
  }

  const supabase = await createClient();
  const rows = entries.map((e) => ({
    edition_id: parsed.data.editionId,
    pcs_slug: e.rider_slug,
    name: e.rider_name,
    team: e.team_name || null,
    bib: e.bib,
    status: 'active' as const,
  }));

  const { error } = await supabase.from('riders').upsert(rows, { onConflict: 'edition_id,pcs_slug' });
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'upsert_riders',
    target: { editionId: parsed.data.editionId, count: rows.length },
  });

  return { ok: true, data: { count: rows.length } };
}

export async function setRiderStatus(
  riderId: string, status: 'active' | 'dnf' | 'dns',
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(riderId);
  if (!parsed.success) return { ok: false, error: 'invalid_rider_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from('riders').update({ status }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'set_rider_status',
    target: { riderId: parsed.data, status },
  });

  return { ok: true, data: undefined };
}
