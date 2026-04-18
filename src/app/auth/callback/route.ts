import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)
  }

  try {
    const supabase = await createClient()

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/sign-in?error=${encodeURIComponent(exchangeError.message)}`,
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(`${origin}/sign-in?error=no_user`)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, deleted_at')
      .eq('id', user.id)
      .single()

    if (!profile || profile.deleted_at !== null) {
      return NextResponse.redirect(`${origin}/onboarding`)
    }

    return NextResponse.redirect(`${origin}/home`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(message)}`,
    )
  }
}
