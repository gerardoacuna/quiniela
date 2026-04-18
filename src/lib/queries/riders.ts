import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function listActiveRiders(editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('riders')
    .select('id, name, team, bib, pcs_slug, status')
    .eq('edition_id', editionId)
    .order('bib', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
