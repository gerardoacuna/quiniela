import { redirect, notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { getUserStagePicks } from '@/lib/queries/picks';
import { listActiveRiders } from '@/lib/queries/riders';
import { StagePickForm } from './form';

export default async function StagePickPage({
  params,
}: {
  params: Promise<{ stageNumber: string }>;
}) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const { stageNumber: numRaw } = await params;
  const stageNumber = Number(numRaw);
  if (!Number.isInteger(stageNumber)) notFound();

  const stage = await getStageByNumber(edition.id, stageNumber);
  if (!stage) notFound();
  if (new Date(stage.start_time).getTime() <= now) redirect(`/stage/${stageNumber}`);

  const [riders, allPicks] = await Promise.all([
    listActiveRiders(edition.id),
    getUserStagePicks(user.id, edition.id),
  ]);

  // Map: rider_id → which other stage uses them (primary OR hedge), if any.
  const usedByRider = new Map<string, { stage_id: string; stage_number: number; stage_status: string }>();
  for (const p of allPicks) {
    const stagesRel = (p as unknown as { stages: { number: number; status: string } }).stages;
    const meta = {
      stage_id: p.stage_id,
      stage_number: stagesRel.number,
      stage_status: stagesRel.status,
    };
    usedByRider.set(p.rider_id, meta);
    const hedgeId = (p as unknown as { hedge_rider_id: string | null }).hedge_rider_id;
    if (hedgeId) usedByRider.set(hedgeId, meta);
  }

  const currentPickForThisStage = allPicks.find((p) => p.stage_id === stage.id) as
    | (typeof allPicks[number] & { hedge_rider_id: string | null })
    | undefined;

  return (
    <StagePickForm
      stageId={stage.id}
      stageNumber={stage.number}
      terrain={stage.terrain ?? 'flat'}
      km={stage.km}
      doublePoints={stage.double_points}
      startTimeIso={stage.start_time}
      initialPrimaryRiderId={currentPickForThisStage?.rider_id ?? null}
      initialHedgeRiderId={currentPickForThisStage?.hedge_rider_id ?? null}
      riders={riders.map((r) => {
        const used = usedByRider.get(r.id);
        return {
          id: r.id,
          name: r.name,
          team: r.team,
          bib: r.bib,
          status: r.status,
          is_top_tier: r.is_top_tier,
          usedOnStageNumber:
            used && used.stage_id !== stage.id && used.stage_status !== 'cancelled'
              ? used.stage_number
              : undefined,
        };
      })}
    />
  );
}
