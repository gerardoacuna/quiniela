import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { JerseyPickForm } from './form';

export default async function JerseyPickPage() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const supabase = await createClient();
  const [{ data: stage1 }, { data: jerseyPick }, { data: riders }] = await Promise.all([
    supabase.from('stages').select('start_time').eq('edition_id', edition.id).eq('number', 1).maybeSingle(),
    supabase
      .from('points_jersey_picks')
      .select('rider_id, riders!inner(id, name, team, bib, status)')
      .eq('user_id', user.id)
      .eq('edition_id', edition.id)
      .maybeSingle(),
    supabase
      .from('riders')
      .select('id, name, team, bib, status')
      .eq('edition_id', edition.id)
      .eq('status', 'active')
      .order('name'),
  ]);

  const isLocked = stage1 ? new Date(stage1.start_time).getTime() <= now : false;

  type JerseyRow = {
    rider_id: string;
    riders: { id: string; name: string; team: string | null; bib: number | null; status: 'active' | 'dnf' | 'dns' };
  };
  const castPick = jerseyPick as unknown as JerseyRow | null;

  return (
    <JerseyPickForm
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
      initialRider={castPick ? castPick.riders : null}
      isLocked={isLocked}
    />
  );
}
