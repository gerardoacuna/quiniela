'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './result';

export async function setRole(userId: string, role: 'admin' | 'player'): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: 'invalid_user_id' };

  const { user } = await requireAdmin();
  if (user.id === parsed.data && role !== 'admin') {
    return { ok: false, error: 'cannot_demote_self' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'set_role',
    target: { userId: parsed.data, role },
  });

  return { ok: true, data: undefined };
}

export async function softDeletePlayer(userId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: 'invalid_user_id' };

  const { user } = await requireAdmin();
  if (user.id === parsed.data) return { ok: false, error: 'cannot_delete_self' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'soft_delete_player',
    target: { userId: parsed.data },
  });

  return { ok: true, data: undefined };
}

export async function restorePlayer(userId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: 'invalid_user_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles').update({ deleted_at: null }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'restore_player',
    target: { userId: parsed.data },
  });

  return { ok: true, data: undefined };
}
