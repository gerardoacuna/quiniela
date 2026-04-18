import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingForm from './form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // If a valid profile already exists, skip onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .eq('id', user.id)
    .single()

  if (profile && profile.deleted_at === null) {
    redirect('/home')
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Welcome!</h1>
          <p className="text-sm text-gray-500">
            Choose a display name to finish setting up your account.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  )
}
