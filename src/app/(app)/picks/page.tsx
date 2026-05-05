import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getPicksIndex } from '@/lib/queries/picks-index';
import { PageHeading } from './page-heading';
import { SectionHeading } from './section-heading';
import { PreRaceStrip } from './pre-race-strip';
import { UsedRidersStrip } from './used-riders-strip';
import { StageRow } from './stage-row';

export default async function PicksPage() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { user } = await requireProfile();
  const data = await getPicksIndex(user.id);
  if (!data) redirect('/home');

  const { stages, picks, results, gcPicks, jerseyPicks } = data;

  const countedStages = stages.filter((s) => s.counts_for_scoring);
  const nonCountedCount = stages.length - countedStages.length;

  // Build a map of picks by stage_id
  type PickRow = (typeof picks)[number];
  type StageRel = { number: number; status: string; double_points: boolean };
  type RiderRel = { id: string; name: string; team: string | null; bib: number | null; status: string };

  const picksByStage = new Map<
    string,
    {
      riderId: string;
      riderName: string;
      riderTeam: string | null;
      underdogRiderId: string | null;
      underdogRiderName: string | null;
      underdogRiderTeam: string | null;
      stageNumber: number;
    }
  >();
  for (const p of picks) {
    const pr = p as unknown as PickRow & {
      stages: StageRel;
      riders: RiderRel;
      underdog_rider_id: string | null;
      underdog_rider: RiderRel | null;
    };
    picksByStage.set(p.stage_id, {
      riderId: p.rider_id,
      riderName: pr.riders.name,
      riderTeam: pr.riders.team,
      underdogRiderId: pr.underdog_rider_id,
      underdogRiderName: pr.underdog_rider?.name ?? null,
      underdogRiderTeam: pr.underdog_rider?.team ?? null,
      stageNumber: pr.stages.number,
    });
  }

  // Build map of results by stage_id
  const resultsByStage = new Map<string, { position: number; riderId: string }>();
  for (const r of results) {
    resultsByStage.set(r.stage_id, { position: r.position, riderId: r.rider_id });
  }

  // Find stage 1 to determine lock
  const stage1 = stages.find((s) => s.number === 1);
  const preRaceLocked = stage1 ? new Date(stage1.start_time).getTime() <= now : false;

  // Picks made count (on counted non-cancelled stages)
  const picksMade = countedStages.filter((s) => s.status !== 'cancelled' && picksByStage.has(s.id)).length;

  // Needed = counted stages with future start_time and no pick
  const openNeeded = countedStages.filter((s) => {
    if (s.status === 'cancelled') return false;
    const futureStage = new Date(s.start_time).getTime() > now;
    return futureStage && !picksByStage.has(s.id);
  }).length;

  // Build a set of counted non-cancelled stage IDs for quick lookup
  const countedNonCancelledIds = new Set(
    countedStages.filter((s) => s.status !== 'cancelled').map((s) => s.id),
  );

  // Used riders strip — riders used on counted, non-cancelled stages
  const usedEntries = Array.from(picksByStage.entries())
    .filter(([stageId]) => countedNonCancelledIds.has(stageId))
    .map(([, p]) => ({
      riderId: p.riderId,
      lastName: p.riderName.split(' ').slice(-1)[0] ?? p.riderName,
      team: p.riderTeam,
      stageNumber: p.stageNumber,
    }))
    .sort((a, b) => a.stageNumber - b.stageNumber);

  // Find the next counted stage (first one with start_time > now and not cancelled)
  const nextStage = countedStages.find(
    (s) => s.status !== 'cancelled' && new Date(s.start_time).getTime() > now,
  );

  // Type cast for gc/jersey picks
  type GcPickRow = (typeof gcPicks)[number] & { riders: { id: string; name: string; team: string | null; bib: number | null } };
  type JerseyPickRowEntry = { kind: 'points' | 'white'; rider_id: string; riders: { id: string; name: string; team: string | null; bib: number | null } };

  const gcPicksCast = gcPicks as unknown as GcPickRow[];
  const jerseyPicksCast = jerseyPicks as unknown as JerseyPickRowEntry[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 16px' }}>
      <PageHeading
        eyebrow="Your picks"
        title="Picks"
        sub={`${picksMade}/${countedStages.length} picks made · ${openNeeded} counted stages still open.`}
      />

      <PreRaceStrip
        gcPicks={gcPicksCast}
        jerseyPicks={jerseyPicksCast}
        locked={preRaceLocked}
      />

      <UsedRidersStrip
        entries={usedEntries}
        totalCountedStages={countedStages.length}
      />

      <div>
        <SectionHeading label="Counted stages" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {countedStages.map((s) => {
            const locked = new Date(s.start_time).getTime() <= now;
            const pick = picksByStage.get(s.id);
            const result = resultsByStage.get(s.id);

            // Only show position result if we have a pick for this stage
            const relevantResult =
              result && pick && result.riderId === pick.riderId ? result : null;

            const underdogResultRow = pick?.underdogRiderId
              ? results.find((r) => r.stage_id === s.id && r.rider_id === pick.underdogRiderId)
              : null;

            return (
              <StageRow
                key={s.id}
                number={s.number}
                startTime={s.start_time}
                terrain={s.terrain ?? 'flat'}
                km={s.km}
                doublePoints={s.double_points}
                status={s.status}
                locked={locked}
                isNext={nextStage?.id === s.id}
                pick={pick ?? null}
                underdogPick={
                  pick?.underdogRiderId
                    ? {
                        riderId: pick.underdogRiderId,
                        riderName: pick.underdogRiderName ?? '—',
                        riderTeam: pick.underdogRiderTeam,
                      }
                    : null
                }
                result={relevantResult ?? null}
                underdogResult={underdogResultRow ? { position: underdogResultRow.position } : null}
              />
            );
          })}
        </div>
      </div>

      {nonCountedCount > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '4px 2px' }}>
          + {nonCountedCount} other stage{nonCountedCount !== 1 ? 's' : ''} in this edition are not counted for scoring.
        </div>
      )}
    </div>
  );
}
