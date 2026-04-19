import { notFound, redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, getStageByNumber, getPublishedStageResults } from '@/lib/queries/stages';
import { getStagePicksForStage } from '@/lib/queries/picks';
import { listActiveRiders } from '@/lib/queries/riders';
import { stagePoints, STAGE_POINT_TABLE } from '@/lib/scoring';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ stageNumber: string }>;
}) {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const { stageNumber: numRaw } = await params;
  const stageNumber = Number(numRaw);
  if (!Number.isInteger(stageNumber)) notFound();

  const stage = await getStageByNumber(edition.id, stageNumber);
  if (!stage) notFound();

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  // If the stage hasn't locked yet, bounce to the pick page.
  if (new Date(stage.start_time).getTime() > now) {
    redirect(`/picks/stage/${stageNumber}`);
  }

  const [results, picks, riders] = await Promise.all([
    getPublishedStageResults(stage.id),
    getStagePicksForStage(stage.id),
    listActiveRiders(edition.id),
  ]);

  const riderById = new Map(riders.map((r) => [r.id, r]));

  const stageMeta = {
    double_points: stage.double_points,
    status: stage.status as
      | 'upcoming'
      | 'locked'
      | 'results_draft'
      | 'published'
      | 'cancelled',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Stage {stage.number}
          {stage.double_points && <Badge className="ml-2" variant="secondary">2×</Badge>}
        </h1>
        <Badge variant={stage.status === 'published' ? 'default' : 'secondary'}>
          {stage.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Results not yet published.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {results.map((r) => {
                const rider = riderById.get(r.rider_id);
                const pts = STAGE_POINT_TABLE[r.position - 1] ?? 0;
                const actualPts = stage.double_points ? pts * 2 : pts;
                return (
                  <li key={r.position} className="flex justify-between">
                    <span>
                      {r.position}. {rider?.name ?? r.rider_id}
                    </span>
                    <span className="font-mono">{actualPts} pts</span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Everyone&apos;s picks</CardTitle>
        </CardHeader>
        <CardContent>
          {picks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No picks submitted.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {picks
                .slice()
                .sort((a, b) => {
                  const da = (a as unknown as { profiles: { display_name: string } }).profiles.display_name;
                  const db = (b as unknown as { profiles: { display_name: string } }).profiles.display_name;
                  return da.localeCompare(db);
                })
                .map((p, idx) => {
                  const name = (p as unknown as { profiles: { display_name: string } }).profiles.display_name;
                  const riderName = (p as unknown as { riders: { name: string } }).riders.name;
                  const pts = stagePoints({ rider_id: p.rider_id }, stageMeta, results.map((r) => ({
                    position: r.position,
                    rider_id: r.rider_id,
                  })));
                  const isSelf = p.user_id === user.id;
                  return (
                    <li
                      key={`${p.user_id}-${idx}`}
                      className={`flex justify-between ${isSelf ? 'font-semibold' : ''}`}
                    >
                      <span>
                        {name} → {riderName}
                      </span>
                      <span className="font-mono">{pts}</span>
                    </li>
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
