'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/actions/result'

const schema = z.object({
  displayName: z.string().min(2).max(50),
})

export async function completeOnboarding(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    displayName: formData.get('displayName'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const { displayName } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { ok: false, error: 'Not authenticated.' }
  }

  const admin = createAdminClient()

  // Find a valid, unused, unexpired invite for this email
  const { data: invite, error: inviteError } = await admin
    .from('invites')
    .select('code')
    .eq('email', user.email)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .single()

  if (inviteError || !invite) {
    return { ok: false, error: 'No valid invite found for your email address.' }
  }

  // Insert profile + mark invite used in parallel
  const [profileResult, inviteResult] = await Promise.all([
    admin.from('profiles').insert({
      id: user.id,
      display_name: displayName,
      email: user.email,
      role: 'player',
    }),
    admin
      .from('invites')
      .update({ used_at: new Date().toISOString() })
      .eq('code', invite.code),
  ])

  // Tolerate duplicate key error (code 23505) — already onboarded on a prior attempt
  if (profileResult.error && profileResult.error.code !== '23505') {
    return { ok: false, error: profileResult.error.message }
  }

  if (inviteResult.error) {
    return { ok: false, error: inviteResult.error.message }
  }

  redirect('/home')
}
