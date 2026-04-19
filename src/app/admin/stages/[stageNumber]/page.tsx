import { notFound, redirect } from 'next/navigation';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { listActiveRiders } from '@/lib/queries/riders';
import { StagePublishForm } from './form';

export default async function AdminStageReviewPage({
  params,
}: { params: Promise<{ stageNumber: string }> }) {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');
  const { stageNumber } = await params;
  const stage = await getStageByNumber(edition.id, Number(stageNumber));
  if (!stage) notFound();

  const supabase = await createClient();
  const [{ data: existing }, riders] = await Promise.all([
    supabase.from('stage_results').select('*').eq('stage_id', stage.id).order('position'),
    listActiveRiders(edition.id),
  ]);

  return (
    <StagePublishForm
      stage={stage}
      initialRows={(existing ?? []).map((r) => ({ position: r.position, rider_id: r.rider_id }))}
      riders={riders.map((r) => ({ id: r.id, name: r.name, bib: r.bib, team: r.team ?? '' }))}
    />
  );
}
