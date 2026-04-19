import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { getUserJerseyPick } from '@/lib/queries/picks';
import { listActiveRiders } from '@/lib/queries/riders';
import { JerseyPickForm } from './form';

export default async function JerseyPickPage() {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const stage1 = await getStageByNumber(edition.id, 1);
  if (stage1 && new Date(stage1.start_time).getTime() <= Date.now()) {
    redirect('/picks');
  }

  const [riders, pick] = await Promise.all([
    listActiveRiders(edition.id),
    getUserJerseyPick(user.id, edition.id),
  ]);

  return (
    <JerseyPickForm
      editionId={edition.id}
      initialSelectedRiderId={pick?.rider_id ?? null}
      riders={riders.map((r) => ({
        id: r.id,
        name: r.name,
        team: r.team,
        bib: r.bib,
        status: r.status,
      }))}
    />
  );
}
