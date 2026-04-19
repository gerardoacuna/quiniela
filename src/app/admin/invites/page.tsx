import { requireProfile } from '@/lib/auth/require-user';
import { redirect } from 'next/navigation';
import { InviteForm } from './form';

export default async function AdminInvitesPage() {
  const { profile } = await requireProfile();
  if (profile.role !== 'admin') redirect('/home');
  return (
    <main className="p-6 space-y-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Generate invite</h1>
      <p className="text-sm text-muted-foreground">
        Creates a single-use invite valid for 7 days. The invitee signs in at
        <code className="mx-1">/sign-in</code> with this email.
      </p>
      <InviteForm />
    </main>
  );
}
