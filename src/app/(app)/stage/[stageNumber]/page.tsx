import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { getStageDetail, type StageDetailData } from '@/lib/queries/stage-detail';
import { StagePickHeader } from '@/app/(app)/picks/stage/[stageNumber]/stage-pick-header';
import { Card } from '@/components/design/card';
import { Badge } from '@/components/design/badge';
import { BibTile } from '@/components/design/bib-tile';
import { TeamChip } from '@/components/design/team-chip';
import { ordinal } from '@/components/design/time';

const POINTS_TABLE = [25, 15, 10, 8, 6, 5, 4, 3, 2, 1];

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
  const multiplier = stage.double_points ? 2 : 1;

  // Group picks by rider for the "who picked whom" section
  const grouped = new Map<
    string,
    { rider: StageDetailData['allPicks'][number]['rider']; names: string[] }
  >();
  for (const p of detail.allPicks) {
    if (!grouped.has(p.rider.id)) grouped.set(p.rider.id, { rider: p.rider, names: [] });
    grouped.get(p.rider.id)!.names.push(p.userId === user.id ? 'You' : p.displayName);
  }
  const groupedList = Array.from(grouped.values()).sort((a, b) => b.names.length - a.names.length);

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

      {scored && detail.results.length > 0 && (
        <ResultsCard
          results={detail.results}
          multiplier={multiplier}
          groupedPicks={grouped}
          myPickRiderId={detail.myPickRiderId}
          doublePoints={stage.double_points}
        />
      )}

      {detail.isLocked && groupedList.length > 0 && (
        <WhoPickedWhomCard
          grouped={groupedList.slice(0, 12)}
          scored={scored}
          resultsMap={new Map(detail.results.map((r) => [r.rider.id, r.position]))}
          multiplier={multiplier}
        />
      )}
    </div>
  );
}

function ResultsCard({
  results,
  multiplier,
  groupedPicks,
  myPickRiderId,
  doublePoints,
}: {
  results: StageDetailData['results'];
  multiplier: number;
  groupedPicks: Map<
    string,
    { rider: StageDetailData['allPicks'][number]['rider']; names: string[] }
  >;
  myPickRiderId: string | null;
  doublePoints: boolean;
}) {
  return (
    <Card pad={0}>
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 1.4,
              color: 'var(--ink-mute)',
              textTransform: 'uppercase',
            }}
          >
            Top 10 · final
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 20,
              marginTop: 2,
            }}
          >
            Stage results
          </div>
        </div>
        {doublePoints && <Badge tone="accent">2× applied</Badge>}
      </div>
      <div>
        {results.map((r) => {
          const pts = (POINTS_TABLE[r.position - 1] ?? 0) * multiplier;
          const isMine = r.rider.id === myPickRiderId;
          const pickers = groupedPicks.get(r.rider.id)?.names.length ?? 0;
          return (
            <div
              key={r.position}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 30px 1fr auto auto',
                gap: 10,
                alignItems: 'center',
                padding: '10px 16px',
                borderTop: '1px solid var(--hair)',
                background: isMine ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 22,
                  color: r.position <= 3 ? 'var(--accent)' : 'var(--ink)',
                }}
              >
                {r.position}
              </span>
              <BibTile num={r.rider.bib} size={26} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isMine ? 700 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.rider.name}
                  {isMine && (
                    <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· your pick</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <TeamChip team={r.rider.team} size={8} />
                  {r.rider.team ?? '—'}
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-mute)',
                }}
              >
                {pickers} picker{pickers === 1 ? '' : 's'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  width: 36,
                  textAlign: 'right',
                }}
              >
                {pts}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WhoPickedWhomCard({
  grouped,
  scored,
  resultsMap,
  multiplier,
}: {
  grouped: Array<{ rider: StageDetailData['allPicks'][number]['rider']; names: string[] }>;
  scored: boolean;
  resultsMap: Map<string, number>;
  multiplier: number;
}) {
  return (
    <Card pad={0}>
      <div style={{ padding: '14px 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.4,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}
        >
          Who picked whom
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 20,
            marginTop: 2,
          }}
        >
          {scored ? 'Scored' : 'Revealed at lock'}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--hair)' }}>
        {grouped.map((g) => {
          const pos = resultsMap.get(g.rider.id);
          const pts = pos != null ? (POINTS_TABLE[pos - 1] ?? 0) * multiplier : 0;
          return (
            <div
              key={g.rider.id}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--hair)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <BibTile num={g.rider.bib} size={24} />
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{g.rider.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  {g.names.length} picker{g.names.length === 1 ? '' : 's'}
                </div>
              </div>
              {scored && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: pos != null ? 'var(--accent)' : 'var(--ink-mute)',
                  }}
                >
                  {pos != null ? `${ordinal(pos)} · +${pts}` : 'out of top 10'}
                </span>
              )}
              <div
                style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 4 }}
              >
                {g.names.slice(0, 12).map((name) => (
                  <span
                    key={name}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: 'var(--surface-alt)',
                      color: name === 'You' ? 'var(--accent)' : 'var(--ink-soft)',
                      fontWeight: name === 'You' ? 700 : 500,
                    }}
                  >
                    {name}
                  </span>
                ))}
                {g.names.length > 12 && (
                  <span style={{ fontSize: 10, padding: '2px 6px', color: 'var(--ink-mute)' }}>
                    +{g.names.length - 12}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
