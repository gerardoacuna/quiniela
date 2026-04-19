import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

export async function getServerUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function requireUser() {
  const user = await getServerUser()
  if (!user) redirect('/sign-in')
  return user
}

export async function requireProfile(): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getServerUser>>>; profile: Profile }> {
  const user = await requireUser()

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.deleted_at !== null) {
    redirect('/onboarding')
  }

  return { user, profile }
}

export async function requireAdmin() {
  const { user, profile } = await requireProfile()
  if (profile.role !== 'admin') redirect('/home')
  return { user, profile }
}
