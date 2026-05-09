import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { getStageDetail, type StageDetailData } from '@/lib/queries/stage-detail';
import { StagePickHeader } from '@/app/(app)/picks/stage/[stageNumber]/stage-pick-header';
import { Card } from '@/components/design/card';
import { Badge } from '@/components/design/badge';
import { pointsForFinish } from '@/lib/scoring';
import { ParticipantsCard, type ParticipantRow } from './participants-card';

export default async function StagePage({
  params,
}: {
  params: Promise<{ stageNumber: string }>;
}) {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const { stageNumber: raw } = await params;
  const n = Number(raw);
  if (!Number.isInteger(n)) notFound();

  const stage = await getStageByNumber(edition.id, n);
  if (!stage) notFound();

  const detail = await getStageDetail(stage.id, user.id);

  const scored = stage.status === 'published';
  const doublePoints = stage.double_points;

  // Pivot picks by user for the participant-centric table.
  type Pivot = {
    primary: StageDetailData['allPicks'][number]['rider'] | null;
    underdog: StageDetailData['allPicks'][number]['rider'] | null;
  };
  const pivot = new Map<string, Pivot>();
  for (const p of detail.allPicks) {
    const cur = pivot.get(p.userId) ?? { primary: null, underdog: null };
    if (p.kind === 'primary') cur.primary = p.rider;
    else cur.underdog = p.rider;
    pivot.set(p.userId, cur);
  }

  const resultsMap = new Map(detail.results.map((r) => [r.rider.id, r.position]));

  const participantRows: ParticipantRow[] = detail.participants.map((part) => {
    const slots = pivot.get(part.userId);
    const primary = slots?.primary ?? null;
    const underdog = slots?.underdog ?? null;
    const primaryPts = primary ? pointsForFinish(resultsMap.get(primary.id) ?? null, doublePoints) : 0;
    const underdogPts = underdog
      ? pointsForFinish(resultsMap.get(underdog.id) ?? null, doublePoints)
      : 0;
    return {
      userId: part.userId,
      displayName: part.displayName,
      primary,
      primaryPts,
      underdog,
      underdogPts,
    };
  });

  participantRows.sort((a, b) => {
    if (a.userId === user.id) return -1;
    if (b.userId === user.id) return 1;
    if (scored) {
      const totalDiff = b.primaryPts + b.underdogPts - (a.primaryPts + a.underdogPts);
      if (totalDiff !== 0) return totalDiff;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link
        href="/picks"
        style={{
          color: 'var(--ink-soft)',
          padding: '6px 0',
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          textDecoration: 'none',
        }}
      >
        ← Picks
      </Link>

      <StagePickHeader
        stageNumber={stage.number}
        terrain={stage.terrain ?? 'flat'}
        km={stage.km}
        doublePoints={stage.double_points}
        startTimeIso={stage.start_time}
      />

      {!scored && detail.isLocked && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge tone="muted">Locked</Badge>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Waiting for results. Typically published within ~2h of the finish.
            </div>
          </div>
        </Card>
      )}

      {detail.isLocked && (
        <ParticipantsCard
          rows={participantRows}
          scored={scored}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}
