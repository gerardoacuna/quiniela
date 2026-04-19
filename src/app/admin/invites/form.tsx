'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateInvite } from './actions';
import type { ActionResult } from '@/lib/actions/result';

export function InviteForm() {
  const [state, action, pending] = useActionState(
    generateInvite,
    null as ActionResult<{ code: string }> | null,
  );
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="email">Invite email</Label>
        <Input id="email" name="email" type="email" required placeholder="friend@example.com" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Generating…' : 'Generate invite'}
      </Button>
      {state?.ok && (
        <p className="text-sm">
          Invite created. Code: <code className="font-mono">{state.data.code}</code>.
        </p>
      )}
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
