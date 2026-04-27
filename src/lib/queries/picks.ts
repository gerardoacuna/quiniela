import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getUserStagePicks(userId: string, editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stage_picks')
    .select('id, stage_id, rider_id, created_at, updated_at, stages!inner(number, status, start_time, edition_id)')
    .eq('user_id', userId)
    .eq('stages.edition_id', editionId);
  if (error) throw error;
  return data ?? [];
}

export async function getUserGcPicks(userId: string, editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('gc_picks')
    .select('*')
    .eq('user_id', userId)
    .eq('edition_id', editionId)
    .order('position');
  if (error) throw error;
  return data ?? [];
}

export async function getUserJerseyPick(userId: string, editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jersey_picks')
    .select('*')
    .eq('user_id', userId)
    .eq('edition_id', editionId)
    .eq('kind', 'points')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStagePicksForStage(stageId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stage_picks')
    .select('user_id, rider_id, profiles!inner(display_name), riders!inner(name, pcs_slug)')
    .eq('stage_id', stageId);
  if (error) throw error;
  return data ?? [];
}
