import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { JerseysPickForm } from './form';

export default async function JerseysPickPage() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const supabase = await createClient();
  const [{ data: stage1 }, { data: jerseyPicks }, { data: riders }] = await Promise.all([
    supabase.from('stages').select('start_time').eq('edition_id', edition.id).eq('number', 1).maybeSingle(),
    supabase
      .from('jersey_picks')
      .select('kind, rider_id, riders!inner(id, name, team, bib, status)')
      .eq('user_id', user.id)
      .eq('edition_id', edition.id),
    supabase
      .from('riders')
      .select('id, name, team, bib, status')
      .eq('edition_id', edition.id)
      .eq('status', 'active')
      .order('name'),
  ]);

  const isLocked = stage1 ? new Date(stage1.start_time).getTime() <= now : false;

  type JerseyRow = {
    kind: 'points' | 'white';
    rider_id: string;
    riders: { id: string; name: string; team: string | null; bib: number | null; status: 'active' | 'dnf' | 'dns' };
  };
  const cast = (jerseyPicks ?? []) as unknown as JerseyRow[];
  const initialPoints = cast.find((r) => r.kind === 'points')?.riders ?? null;
  const initialWhite = cast.find((r) => r.kind === 'white')?.riders ?? null;

  return (
    <JerseysPickForm
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
      initialPoints={initialPoints}
      initialWhite={initialWhite}
      isLocked={isLocked}
    />
  );
}
