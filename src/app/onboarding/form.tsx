'use client'

import { useActionState } from 'react'
import { completeOnboarding } from './actions'
import type { ActionResult } from '@/lib/actions/result'

const initialState: ActionResult | null = null

export default function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(completeOnboarding, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          minLength={2}
          maxLength={50}
          placeholder="e.g. Tadej Fan 2026"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Finish setup'}
      </button>
    </form>
  )
}
