import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface StageDetailData {
  stage: {
    id: string;
    number: number;
    start_time: string;
    status: 'upcoming' | 'locked' | 'results_draft' | 'published' | 'cancelled';
    counts_for_scoring: boolean;
    double_points: boolean;
    terrain: 'flat' | 'hilly' | 'mountain' | 'itt';
    km: number;
  } | null;
  results: Array<{
    position: number;
    rider: {
      id: string;
      name: string;
      team: string | null;
      bib: number | null;
      status: 'active' | 'dnf' | 'dns';
    };
  }>;
  allPicks: Array<{
    userId: string;
    displayName: string;
    rider: {
      id: string;
      name: string;
      team: string | null;
      bib: number | null;
      status: 'active' | 'dnf' | 'dns';
    };
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
        .select('user_id, profiles!inner(display_name), riders!inner(id, name, team, bib, status)')
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
    riders: {
      id: string;
      name: string;
      team: string | null;
      bib: number | null;
      status: string;
    };
  };
  type RawPick = {
    user_id: string;
    profiles: { display_name: string };
    riders: {
      id: string;
      name: string;
      team: string | null;
      bib: number | null;
      status: string;
    };
  };

  return {
    stage: stage as StageDetailData['stage'],
    results: ((results ?? []) as unknown as RawResult[]).map((r) => ({
      position: r.position,
      rider: {
        id: r.riders.id,
        name: r.riders.name,
        team: r.riders.team,
        bib: r.riders.bib,
        status: r.riders.status as 'active' | 'dnf' | 'dns',
      },
    })),
    allPicks: isLocked
      ? ((allPicks ?? []) as unknown as RawPick[]).map((p) => ({
          userId: p.user_id,
          displayName: p.profiles.display_name,
          rider: {
            id: p.riders.id,
            name: p.riders.name,
            team: p.riders.team,
            bib: p.riders.bib,
            status: p.riders.status as 'active' | 'dnf' | 'dns',
          },
        }))
      : [],
    myPickRiderId: myPick?.rider_id ?? null,
    isLocked,
  };
}
