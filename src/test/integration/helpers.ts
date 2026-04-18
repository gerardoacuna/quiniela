import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export async function createTestUser(role: 'player' | 'admin' = 'player') {
  const admin = createAdminClient();
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'test-password-123';

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error('no user created');

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    display_name: `Test ${created.user.id.slice(0, 6)}`,
    role,
    email,
  });
  if (profileErr) throw profileErr;

  return {
    userId: created.user.id,
    email,
    password,
    cleanup: async () => {
      await admin.from('profiles').delete().eq('id', created.user!.id);
      await admin.auth.admin.deleteUser(created.user!.id);
    },
  };
}

export async function userClient(email: string, password: string): Promise<SupabaseClient<Database>> {
  const c = createSupabaseJs<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error('signin failed');
  return c;
}

export async function setStageState(stageId: string, state: {
  start_time?: string;
  status?: Database['public']['Enums']['stage_status'];
  counts_for_scoring?: boolean;
  double_points?: boolean;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('stages').update(state).eq('id', stageId);
  if (error) throw error;
}
