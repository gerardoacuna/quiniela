import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { RosterRow } from './form';

export default async function AdminRosterPage() {
  const { user: me } = await requireAdmin();
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from('profiles').select('*').order('display_name');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Roster</h1>
      <table className="w-full text-sm border rounded">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Role</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p) => (
            <RosterRow key={p.id} profile={p} isSelf={p.id === me.id} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
