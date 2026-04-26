import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/design/card'
import { Logo } from '@/components/design/logo'
import OnboardingForm from './form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .eq('id', user.id)
    .single()

  if (profile && profile.deleted_at === null) {
    redirect('/home')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Logo size={44} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 22,
                color: 'var(--ink)',
                letterSpacing: -0.3,
              }}
            >
              Quiniela
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-mute)',
                letterSpacing: 1,
                marginTop: 4,
              }}
            >
              GIRO · MMXXVI
            </span>
          </div>
        </div>

        <Card pad={28} style={{ width: '100%' }}>
          <OnboardingForm />
        </Card>

        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'var(--ink-mute)',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            letterSpacing: 0.4,
          }}
        >
          Private Giro 2026 pickem · invite-only
        </p>
      </div>
    </main>
  )
}
