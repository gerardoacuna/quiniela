import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

export type StageRow = Database['public']['Tables']['stages']['Row'];
export type StageResultRow = Database['public']['Tables']['stage_results']['Row'];
export type EditionRow = Database['public']['Tables']['editions']['Row'];

export async function getActiveEdition(): Promise<EditionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCountedStages(editionId: string): Promise<StageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('edition_id', editionId)
    .eq('counts_for_scoring', true)
    .order('number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getStageByNumber(editionId: string, number: number): Promise<StageRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('edition_id', editionId)
    .eq('number', number)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPublishedStageResults(stageId: string): Promise<StageResultRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stage_results')
    .select('*')
    .eq('stage_id', stageId)
    .eq('status', 'published')
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
