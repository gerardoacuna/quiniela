'use server';

import { z } from 'zod';
import { requireProfile } from '@/lib/auth/require-user';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/actions/result';

function shortCode(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

const schema = z.object({ email: z.string().email() });

export async function generateInvite(
  _prev: ActionResult<{ code: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ code: string }>> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { ok: false, error: 'invalid_email' };

  const { user, profile } = await requireProfile();
  if (profile.role !== 'admin') return { ok: false, error: 'forbidden' };

  const admin = createAdminClient();
  const code = shortCode();
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();

  const { error } = await admin.from('invites').insert({
    code,
    created_by: user.id,
    email: parsed.data.email,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { code } };
}
