import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { GcPickForm } from './form';

export default async function GcPickPage() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const supabase = await createClient();
  const [{ data: stage1 }, { data: gcPicks }, { data: riders }] = await Promise.all([
    supabase.from('stages').select('start_time').eq('edition_id', edition.id).eq('number', 1).maybeSingle(),
    supabase
      .from('gc_picks')
      .select('position, rider_id, riders!inner(id, name, team, bib, status)')
      .eq('user_id', user.id)
      .eq('edition_id', edition.id)
      .order('position'),
    supabase
      .from('riders')
      .select('id, name, team, bib, status')
      .eq('edition_id', edition.id)
      .eq('status', 'active')
      .order('name'),
  ]);

  const isLocked = stage1 ? new Date(stage1.start_time).getTime() <= now : false;

  type GcRow = {
    position: number;
    rider_id: string;
    riders: { id: string; name: string; team: string | null; bib: number | null; status: 'active' | 'dnf' | 'dns' };
  };
  const initial = ((gcPicks ?? []) as unknown as GcRow[]).map((g) => ({
    position: g.position,
    rider: g.riders,
  }));

  return (
    <GcPickForm
      editionId={edition.id}
      riders={
        (riders ?? []) as Array<{
          id: string;
          name: string;
          team: string | null;
          bib: number | null;
          status: 'active' | 'dnf' | 'dns';
        }>
      }
      initialPicks={initial}
      isLocked={isLocked}
    />
  );
}
