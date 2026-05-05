import { redirect } from 'next/navigation';
import { getActiveEdition } from '@/lib/queries/stages';
import { listActiveRiders } from '@/lib/queries/riders';
import { RidersTable } from './form';

export default async function AdminRidersPage() {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');

  const riders = await listActiveRiders(edition.id);
  const year = new Date(edition.start_date).getUTCFullYear();

  return (
    <RidersTable
      editionId={edition.id}
      editionSlug={edition.slug}
      year={year}
      riders={riders.map((r) => ({
        id: r.id,
        name: r.name,
        team: r.team,
        bib: r.bib,
        status: r.status,
        pcs_slug: r.pcs_slug,
        is_top_tier: r.is_top_tier,
      }))}
    />
  );
}
