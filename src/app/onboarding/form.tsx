'use client'

import { useActionState, useState } from 'react'
import { DsButton } from '@/components/design/button'
import { completeOnboarding } from './actions'
import type { ActionResult } from '@/lib/actions/result'

const initialState: ActionResult | null = null

export default function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(completeOnboarding, initialState)
  const [nameFocused, setNameFocused] = useState(false)

  return (
    <form
      action={formAction}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.4,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Set up
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 28,
            lineHeight: 1.1,
            color: 'var(--ink)',
            letterSpacing: -0.4,
          }}
        >
          Welcome!
        </h1>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 13,
            color: 'var(--ink-soft)',
          }}
        >
          Choose a display name to finish setting up your account.
        </p>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.2,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}
        >
          Display name
        </span>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          minLength={2}
          maxLength={50}
          placeholder="e.g. Tadej Fan 2026"
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          style={{
            background: 'var(--surface-alt)',
            border: `1px solid ${nameFocused ? 'var(--accent)' : 'var(--hair)'}`,
            color: 'var(--ink)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            outline: 'none',
            transition: 'border-color 120ms ease',
          }}
        />
      </label>

      {state && !state.ok && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
          {state.error}
        </p>
      )}

      <DsButton
        type="submit"
        variant="accent"
        size="lg"
        full
        disabled={isPending}
      >
        {isPending ? 'Saving…' : 'Finish setup'}
      </DsButton>
    </form>
  )
}
