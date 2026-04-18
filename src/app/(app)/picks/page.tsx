import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, listCountedStages } from '@/lib/queries/stages';
import { getUserStagePicks, getUserGcPicks, getUserJerseyPick } from '@/lib/queries/picks';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function PicksPage() {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const [stages, stagePicks, gcPicks, jerseyPick] = await Promise.all([
    listCountedStages(edition.id),
    getUserStagePicks(user.id, edition.id),
    getUserGcPicks(user.id, edition.id),
    getUserJerseyPick(user.id, edition.id),
  ]);

  const picksByStage = new Map(stagePicks.map((p) => [p.stage_id, p]));

  const stage1 = stages.find((s) => s.number === 1);
  const stage1Locked = stage1 ? new Date(stage1.start_time).getTime() <= Date.now() : false;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Picks</h1>

      <Card>
        <CardHeader>
          <CardTitle>GC top 3</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {gcPicks.length === 3 ? 'Picks saved.' : stage1Locked ? 'Locked.' : 'Not picked yet.'}
          </span>
          {!stage1Locked && (
            <Link href="/picks/gc" className="text-primary underline text-sm">
              {gcPicks.length === 3 ? 'Edit' : 'Pick'}
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points jersey</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {jerseyPick ? 'Pick saved.' : stage1Locked ? 'Locked.' : 'Not picked yet.'}
          </span>
          {!stage1Locked && (
            <Link href="/picks/jersey" className="text-primary underline text-sm">
              {jerseyPick ? 'Edit' : 'Pick'}
            </Link>
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold pt-4">Stages</h2>
      <ul className="space-y-2">
        {stages.map((s) => {
          const pick = picksByStage.get(s.id);
          const locked = new Date(s.start_time).getTime() <= Date.now();
          const published = s.status === 'published';
          return (
            <li key={s.id}>
              <Link
                href={locked ? `/stage/${s.number}` : `/picks/stage/${s.number}`}
                className="flex items-center justify-between border rounded px-4 py-3 hover:bg-muted"
              >
                <div>
                  <span className="font-medium">Stage {s.number}</span>
                  {s.double_points && <Badge className="ml-2" variant="secondary">2×</Badge>}
                </div>
                <div className="text-sm">
                  {published ? (
                    <Badge>Scored</Badge>
                  ) : locked ? (
                    <Badge variant="secondary">Locked</Badge>
                  ) : pick ? (
                    <Badge variant="outline">Picked</Badge>
                  ) : (
                    <Badge variant="destructive">Pick</Badge>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
