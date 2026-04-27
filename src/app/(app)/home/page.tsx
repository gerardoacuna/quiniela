import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getHomeData } from '@/lib/queries/home';
import { createClient } from '@/lib/supabase/server';
import { stagePoints } from '@/lib/scoring';
import { HeroNextStage } from './hero-next-stage';
import { StageTimeline } from '@/components/stage-timeline';
import { StandingCard } from './standing-card';
import { RecentPicksCard } from './recent-picks-card';
import { TopFiveCard } from './top-five-card';
import { PreRaceCard } from './pre-race-card';
import type { TimelineStage } from '@/components/stage-timeline';
import type { RecentPick } from './recent-picks-card';
import type { GcPickRow, JerseyPickRow } from './pre-race-card';

export default async function HomePage() {
  const { user } = await requireProfile();
  const data = await getHomeData(user.id);
  if (!data) redirect('/sign-in');

  const { picks, results, board } = data;
  const stages = data.stages.filter((s) => s.counts_for_scoring);

  // Determine the "current" / next stage to act on:
  // Prefer the first stage that is 'upcoming' or 'locked' (i.e. not yet published/cancelled)
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const nextStage = stages.find(
    (s) =>
      (s.status === 'upcoming' && new Date(s.start_time).getTime() > now) ||
      s.status === 'locked' ||
      s.status === 'results_draft',
  ) ?? stages.find((s) => s.status === 'upcoming') ?? null;

  // Pick for the next stage
  const myPickForNext = nextStage
    ? picks.find((p) => p.stage_id === nextStage.id) ?? null
    : null;

  // Me in board
  const me = board.find((r) => r.user_id === user.id) ?? null;

  // Build timeline stages (all stages, with hasPick + points)
  const timelineStages: TimelineStage[] = stages.map((s) => {
    const pick = picks.find((p) => p.stage_id === s.id);
    const stageResults = results.filter((r) => r.stage_id === s.id);
    const pts = s.status === 'published' && pick
      ? stagePoints(
          { rider_id: pick.rider_id },
          { double_points: s.double_points, status: s.status },
          stageResults,
        )
      : null;
    return {
      id: s.id,
      number: s.number,
      counts_for_scoring: s.counts_for_scoring,
      double_points: s.double_points,
      status: s.status,
      terrain: s.terrain,
      km: s.km,
      hasPick: pick != null,
      points: pts,
    };
  });

  // Recent scored picks (last 3, most recent first)
  const scoredPicks = picks
    .filter((p) => p.stages.status === 'published')
    .map((p) => {
      const stageResults = results.filter((r) => r.stage_id === p.stage_id);
      const pts = stagePoints(
        { rider_id: p.rider_id },
        { double_points: p.stages.double_points, status: 'published' },
        stageResults,
      );
      const resultRow = stageResults.find((r) => r.rider_id === p.rider_id);
      return {
        stageN: p.stages.number,
        rider: {
          name: p.riders.name,
          team: p.riders.team,
        },
        position: resultRow?.position ?? null,
        points: pts,
      };
    })
    .sort((a, b) => b.stageN - a.stageN)
    .slice(0, 3) satisfies RecentPick[];

  // Around-me board rows (for TopFiveCard when rank > 5)
  let aroundMe = board.slice(0, 0);
  if (me && me.rank > 5) {
    const idx = board.findIndex((r) => r.user_id === me.user_id);
    if (idx !== -1) {
      const start = Math.max(0, idx - 1);
      const end = Math.min(board.length, idx + 2);
      aroundMe = board.slice(start, end);
    }
  }

  // GC picks and Jersey pick (fetched here to avoid another query file)
  const supabase = await createClient();

  const [{ data: gcPicksRaw }, { data: jerseyRaw }] = await Promise.all([
    supabase
      .from('gc_picks')
      .select('position, rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', user.id)
      .eq('edition_id', data.edition.id)
      .order('position'),
    supabase
      .from('jersey_picks')
      .select('rider_id, riders!inner(id, name, team, bib)')
      .eq('user_id', user.id)
      .eq('edition_id', data.edition.id)
      .eq('kind', 'points')
      .maybeSingle(),
  ]);

  const gcPicks: GcPickRow[] = (gcPicksRaw ?? []).map((g) => ({
    position: g.position,
    rider: g.riders as { id: string; name: string; team: string | null; bib: number | null },
  }));

  const jerseyPick: JerseyPickRow = jerseyRaw
    ? {
        rider: jerseyRaw.riders as { id: string; name: string; team: string | null; bib: number | null },
      }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '0 16px' }}>
      {nextStage ? (
        <HeroNextStage
          stage={nextStage}
          pick={myPickForNext ? { rider: myPickForNext.riders } : null}
          nextStageHref={`/picks/stage/${nextStage.number}`}
          stageHref={`/stage/${nextStage.number}`}
        />
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
          padding: '22px 20px',
          fontSize: 15,
          color: 'var(--ink-soft)',
        }}>
          All stages complete.
        </div>
      )}

      <StageTimeline stages={timelineStages} currentNumber={nextStage?.number ?? null} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <StandingCard me={me} board={board} />
        <RecentPicksCard recent={scoredPicks} />
      </div>

      <TopFiveCard rows={board.slice(0, 5)} around={aroundMe} me={me} />

      <PreRaceCard gcPicks={gcPicks} jerseyPick={jerseyPick} />
    </div>
  );
}
