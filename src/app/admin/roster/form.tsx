'use client';
import { useTransition, useState } from 'react';
import { setRole, softDeletePlayer, restorePlayer } from '@/lib/actions/admin-roster';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/lib/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function RosterRow({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const deleted = !!profile.deleted_at;

  return (
    <tr className={`border-t ${deleted ? 'opacity-60 line-through' : ''}`}>
      <td className="p-2">{profile.display_name}{isSelf && <Badge className="ml-2" variant="secondary">you</Badge>}</td>
      <td className="p-2 text-muted-foreground">{profile.email}</td>
      <td className="p-2 capitalize">{profile.role}</td>
      <td className="p-2 text-right flex gap-1 justify-end">
        {!deleted && profile.role === 'player' && !isSelf && (
          <Button size="sm" variant="outline" disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const r = await setRole(profile.id, 'admin');
                setStatus(r.ok ? null : r.error);
              });
            }}
          >Promote</Button>
        )}
        {!deleted && profile.role === 'admin' && !isSelf && (
          <Button size="sm" variant="outline" disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const r = await setRole(profile.id, 'player');
                setStatus(r.ok ? null : r.error);
              });
            }}
          >Demote</Button>
        )}
        {!deleted && !isSelf && (
          <Button size="sm" variant="destructive" disabled={pending}
            onClick={() => {
              if (!confirm(`Soft-delete ${profile.display_name}?`)) return;
              startTransition(async () => {
                const r = await softDeletePlayer(profile.id);
                setStatus(r.ok ? null : r.error);
              });
            }}
          >Delete</Button>
        )}
        {deleted && (
          <Button size="sm" variant="outline" disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const r = await restorePlayer(profile.id);
                setStatus(r.ok ? null : r.error);
              });
            }}
          >Restore</Button>
        )}
        {status && <span className="text-xs text-red-600 ml-2">{status}</span>}
      </td>
    </tr>
  );
}
