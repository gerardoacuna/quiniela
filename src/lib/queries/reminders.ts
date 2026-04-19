import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export async function findUsersNeedingReminderForStage(stageId: string) {
  const admin = createAdminClient();

  const { data: players } = await admin
    .from('profiles').select('id, display_name, email').is('deleted_at', null);

  const { data: picked } = await admin
    .from('stage_picks').select('user_id').eq('stage_id', stageId);
  const pickedSet = new Set((picked ?? []).map((p) => p.user_id));

  const { data: reminded } = await admin
    .from('pick_reminders_sent').select('user_id').eq('stage_id', stageId);
  const remindedSet = new Set((reminded ?? []).map((r) => r.user_id));

  return (players ?? []).filter((p) => !pickedSet.has(p.id) && !remindedSet.has(p.id) && p.email);
}
