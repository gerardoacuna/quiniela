import 'server-only';
import { createClient } from '@/lib/supabase/server';

type StageStatus = 'upcoming' | 'locked' | 'results_draft' | 'published' | 'cancelled';
type RiderStatus = 'active' | 'dnf' | 'dns';

interface StageRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: RiderStatus;
}

export interface StageDetailData {
  stage: {
    id: string;
    number: number;
    start_time: string;
    status: StageStatus;
    counts_for_scoring: boolean;
    double_points: boolean;
    terrain: 'flat' | 'hilly' | 'mountain' | 'itt';
    km: number;
  } | null;
  results: Array<{
    position: number;
    rider: StageRider;
  }>;
  allPicks: Array<{
    userId: string;
    displayName: string;
    kind: 'primary' | 'underdog';
    rider: StageRider;
  }>;
  myPickRiderId: string | null;
  isLocked: boolean;
}

export async function getStageDetail(
  stageId: string,
  currentUserId: string,
): Promise<StageDetailData> {
  const supabase = await createClient();

  const [{ data: stage }, { data: results }, { data: allPicks }, { data: myPick }] =
    await Promise.all([
      supabase
        .from('stages')
        .select('id, number, start_time, status, counts_for_scoring, double_points, terrain, km')
        .eq('id', stageId)
        .maybeSingle(),
      supabase
        .from('stage_results')
        .select('position, riders!inner(id, name, team, bib, status)')
        .eq('stage_id', stageId)
        .eq('status', 'published')
        .order('position'),
      supabase
        .from('stage_picks')
        .select(
          'user_id, profiles!inner(display_name), ' +
            'primary_rider:riders!stage_picks_rider_id_fkey!inner(id, name, team, bib, status), ' +
            'underdog_rider:riders!stage_picks_underdog_rider_id_fkey(id, name, team, bib, status)',
        )
        .eq('stage_id', stageId),
      supabase
        .from('stage_picks')
        .select('rider_id')
        .eq('stage_id', stageId)
        .eq('user_id', currentUserId)
        .maybeSingle(),
    ]);

  const isLocked = stage ? new Date(stage.start_time).getTime() <= Date.now() : false;

  type RawResult = {
    position: number;
    riders: { id: string; name: string; team: string | null; bib: number | null; status: string };
  };
  type RawPickRow = {
    user_id: string;
    profiles: { display_name: string };
    primary_rider: { id: string; name: string; team: string | null; bib: number | null; status: string };
    underdog_rider: { id: string; name: string; team: string | null; bib: number | null; status: string } | null;
  };

  const rawPicks = (allPicks ?? []) as unknown as RawPickRow[];

  // RLS already gates visibility: pre-stage-lock the SELECT returns only the
  // caller's row. We don't add an `if (!isLocked) return []` guard here — that
  // would let app-level drift desync from DB rules. The "locked" flag downstream
  // controls UI rendering only.
  const allPicksFlat: StageDetailData['allPicks'] = rawPicks.flatMap((p) => {
    const out: StageDetailData['allPicks'] = [
      {
        userId: p.user_id,
        displayName: p.profiles.display_name,
        kind: 'primary',
        rider: {
          id: p.primary_rider.id,
          name: p.primary_rider.name,
          team: p.primary_rider.team,
          bib: p.primary_rider.bib,
          status: p.primary_rider.status as RiderStatus,
        },
      },
    ];
    if (p.underdog_rider) {
      out.push({
        userId: p.user_id,
        displayName: p.profiles.display_name,
        kind: 'underdog',
        rider: {
          id: p.underdog_rider.id,
          name: p.underdog_rider.name,
          team: p.underdog_rider.team,
          bib: p.underdog_rider.bib,
          status: p.underdog_rider.status as RiderStatus,
        },
      });
    }
    return out;
  });

  return {
    stage: stage as StageDetailData['stage'],
    results: ((results ?? []) as unknown as RawResult[]).map((r) => ({
      position: r.position,
      rider: {
        id: r.riders.id,
        name: r.riders.name,
        team: r.riders.team,
        bib: r.riders.bib,
        status: r.riders.status as RiderStatus,
      },
    })),
    allPicks: isLocked ? allPicksFlat : [],
    myPickRiderId: myPick?.rider_id ?? null,
    isLocked,
  };
}
