import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { getUserGcPicks } from '@/lib/queries/picks';
import { listActiveRiders } from '@/lib/queries/riders';
import { GcPickForm } from './form';

export default async function GcPickPage() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  // Enforce the lock window server-side: redirect away if Stage 1 has already started.
  const stage1 = await getStageByNumber(edition.id, 1);
  if (stage1 && new Date(stage1.start_time).getTime() <= now) {
    redirect('/picks');
  }

  const [riders, existingPicks] = await Promise.all([
    listActiveRiders(edition.id),
    getUserGcPicks(user.id, edition.id),
  ]);

  const byPosition = new Map(existingPicks.map((p) => [p.position, p.rider_id]));

  return (
    <GcPickForm
      editionId={edition.id}
      initial={{
        first: byPosition.get(1) ?? null,
        second: byPosition.get(2) ?? null,
        third: byPosition.get(3) ?? null,
      }}
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
