import Link from 'next/link';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, listCountedStages } from '@/lib/queries/stages';
import { getUserStagePicks } from '@/lib/queries/picks';
import { getLeaderboard } from '@/lib/queries/leaderboard';
import { CountdownBadge } from '@/components/countdown-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function HomePage() {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) {
    return <div className="p-6">No active edition configured.</div>;
  }

  const [stages, picks, leaderboard] = await Promise.all([
    listCountedStages(edition.id),
    getUserStagePicks(user.id, edition.id),
    getLeaderboard(),
  ]);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const nextStage = stages.find((s) => new Date(s.start_time).getTime() > now);
  const myPickForNext = nextStage ? picks.find((p) => p.stage_id === nextStage.id) : null;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Home</h1>

      {nextStage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Stage {nextStage.number}
              {nextStage.double_points && <Badge className="ml-2" variant="secondary">2×</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Locks in</div>
            <CountdownBadge targetIso={nextStage.start_time} />
            <div className="text-sm pt-2">
              {myPickForNext ? 'Pick saved.' : <span className="text-red-600">No pick yet.</span>}
            </div>
            <Link
              href={`/picks/stage/${nextStage.number}`}
              className="text-primary underline text-sm inline-block"
            >
              {myPickForNext ? 'Change pick →' : 'Pick a rider →'}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>No upcoming stages</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All counted stages have already locked.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard — top 5</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players yet.</p>
          ) : (
            <ol className="space-y-1">
              {leaderboard.slice(0, 5).map((r) => {
                const isSelf = r.user_id === user.id;
                return (
                  <li key={r.user_id} className="flex justify-between text-sm">
                    <span>
                      {r.rank}.{' '}
                      {isSelf ? <strong>{r.display_name}</strong> : r.display_name}
                    </span>
                    <span className="font-mono">{r.total_points}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <Link className="text-primary underline text-sm mt-3 inline-block" href="/board">
            Full leaderboard →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
