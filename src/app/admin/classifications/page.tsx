import { redirect } from 'next/navigation';
import { getActiveEdition } from '@/lib/queries/stages';
import { listActiveRiders } from '@/lib/queries/riders';
import { createClient } from '@/lib/supabase/server';
import { FinalForm } from './form';

export default async function AdminFinalPage() {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');

  const supabase = await createClient();
  const [{ data: existing }, riders] = await Promise.all([
    supabase.from('final_classifications').select('*').eq('edition_id', edition.id),
    listActiveRiders(edition.id),
  ]);

  const gcByPos = new Map((existing ?? []).filter((r) => r.kind === 'gc').map((r) => [r.position, r.rider_id]));
  const jersey = (existing ?? []).find((r) => r.kind === 'points_jersey');
  const whiteJersey = (existing ?? []).find((r) => r.kind === 'white_jersey');

  return (
    <FinalForm
      editionId={edition.id}
      initialGc={{
        first:  gcByPos.get(1) ?? '',
        second: gcByPos.get(2) ?? '',
        third:  gcByPos.get(3) ?? '',
      }}
      initialJersey={jersey?.rider_id ?? ''}
      initialWhiteJersey={whiteJersey?.rider_id ?? ''}
      riders={riders.map((r) => ({ id: r.id, name: r.name, bib: r.bib, team: r.team ?? '' }))}
    />
  );
}
