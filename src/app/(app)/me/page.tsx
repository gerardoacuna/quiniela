import { requireProfile } from '@/lib/auth/require-user';
import { getMeData } from '@/lib/queries/me';
import { stageRowPoints } from '@/lib/scoring';
import { ordinal } from '@/components/design/time';
import { PageHeading } from '@/app/(app)/picks/page-heading';
import { SectionHeading } from '@/app/(app)/picks/section-heading';
import { Card } from '@/components/design/card';
import { BibTile } from '@/components/design/bib-tile';
import { SignOutButton } from '@/components/sign-out-button';
import { BigStat } from './big-stat';

export default async function MePage() {
  const { user } = await requireProfile();
  const data = await getMeData(user.id);

  if (!data) {
    return (
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PageHeading eyebrow="Your account" title="You" />
        <Card>
          <div style={{ fontSize: 14, color: 'var(--ink-mute)' }}>No active edition.</div>
        </Card>
        <SignOutButton />
      </div>
    );
  }

  const { edition, profile, rank, board, stagePicks, gcPicks, jerseyPicks, results, countedStagesTotal } = data;

  // Scored stage picks — only stages that are published. Underdog picks contribute their own
  // sub-row per (stage, kind), so a single stage can produce up to two history rows.
  type ScoredStagePick = {
    stageN: number;
    kind: 'primary' | 'underdog';
    riderName: string;
    stageDetail: string;
    position: number | null;
    points: number;
  };

  const scoredStagePicks: ScoredStagePick[] = stagePicks
    .filter((p) => p.stages.status === 'published')
    .flatMap((p) => {
      const stageResults = results.filter((r) => r.stage_id === p.stage_id);
      const stageMeta = { double_points: p.stages.double_points, status: 'published' as const };
      const breakdown = stageRowPoints(
        { rider_id: p.rider_id, underdog_rider_id: p.underdog_rider_id },
        stageMeta,
        stageResults,
      );
      const primaryRow = stageResults.find((r) => r.rider_id === p.rider_id);
      const out: ScoredStagePick[] = [
        {
          stageN: p.stages.number,
          kind: 'primary',
          riderName: p.riders.name,
          stageDetail: `Stage ${p.stages.number} · ${p.stages.terrain} · ${p.stages.km} km`,
          position: primaryRow?.position ?? null,
          points: breakdown.primary,
        },
      ];
      if (p.underdog_rider_id && p.underdog_rider) {
        const underdogRow = stageResults.find((r) => r.rider_id === p.underdog_rider_id);
        out.push({
          stageN: p.stages.number,
          kind: 'underdog',
          riderName: p.underdog_rider.name,
          stageDetail: `Stage ${p.stages.number} · underdog`,
          position: underdogRow?.position ?? null,
          points: breakdown.underdog,
        });
      }
      return out;
    })
    .sort((a, b) => a.stageN - b.stageN || (a.kind === 'primary' ? -1 : 1));

  // "Made" stat: user picks on counted stages vs total counted stages in the edition.
  // stage_picks can only reference stages flagged counts_for_scoring in the admin,
  // so the length is the numerator; the total comes from the stages count query.
  const totalPicksMade = stagePicks.length;

  const totalPoints = board?.total_points ?? 0;
  const exactWinners = board?.exact_winners_count ?? 0;

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeading
        eyebrow="Your account"
        title="You"
        sub={profile.email ?? ''}
      />

      {/* 4-col stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <BigStat label="Rank" value={rank != null ? `#${rank}` : '—'} />
        <BigStat label="Points" value={totalPoints} mono />
        <BigStat label="Exact" value={exactWinners} mono />
        <BigStat label="Made" value={`${totalPicksMade}/${countedStagesTotal}`} mono />
      </div>

      {/* Stage picks history */}
      <SectionHeading label="Stage picks · history" />
      <Card pad={0}>
        {scoredStagePicks.length === 0 ? (
          <div style={{ padding: '14px', fontSize: 13, color: 'var(--ink-mute)' }}>
            No scored picks yet.
          </div>
        ) : (
          scoredStagePicks.map((s) => (
            <div
              key={`${s.stageN}-${s.kind}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr auto auto',
                gap: 10,
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid var(--hair)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 22,
                  color: 'var(--ink)',
                }}
              >
                {s.kind === 'primary' ? s.stageN : ''}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: 1,
                      color: s.kind === 'underdog' ? 'var(--accent)' : 'var(--ink-mute)',
                      width: 14,
                      flexShrink: 0,
                      fontWeight: 700,
                    }}
                  >
                    {s.kind === 'primary' ? 'P' : 'H'}
                  </span>
                  {s.riderName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{s.stageDetail}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {s.position ? ordinal(s.position) : '—'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: s.points > 0 ? 'var(--accent)' : 'var(--ink-mute)',
                  width: 34,
                  textAlign: 'right',
                }}
              >
                +{s.points}
              </span>
            </div>
          ))
        )}
      </Card>

      {/* Pre-race picks */}
      <SectionHeading label="Pre-race picks" />
      <Card>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-mute)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          GC Top 3
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
          {gcPicks.length === 0
            ? [0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--surface-alt, var(--surface))',
                    border: '1px solid var(--hair)',
                    borderRadius: 'var(--radius)',
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--accent)',
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    P{i + 1}
                  </div>
                  <div style={{ margin: '6px auto', opacity: 0.3 }}>
                    <BibTile num={null} size={30} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>—</div>
                </div>
              ))
            : gcPicks.map((g) => (
                <div
                  key={g.position}
                  style={{
                    background: 'var(--surface-alt, var(--surface))',
                    border: '1px solid var(--hair)',
                    borderRadius: 'var(--radius)',
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--accent)',
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    P{g.position}
                  </div>
                  <div style={{ margin: '6px auto' }}>
                    <BibTile num={g.riders.bib} size={30} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    {g.riders.name.split(' ').slice(-1)[0]}
                  </div>
                </div>
              ))}
        </div>

        <div style={{ height: 1, background: 'var(--hair)', margin: '14px 0' }} />

        {(['points', 'white'] as const).map((kind) => {
          const pick = jerseyPicks.find((j) => j.kind === kind) ?? null;
          const label = kind === 'points' ? 'Points jersey' : 'White jersey';
          return (
            <div key={kind}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-mute)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  marginTop: kind === 'white' ? 14 : 0,
                }}
              >
                {label}
              </div>

              {pick ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <BibTile num={pick.riders.bib} size={30} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{pick.riders.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                      {pick.riders.team ?? ''}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, opacity: 0.4 }}>
                  <BibTile num={null} size={30} />
                  <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>No pick</div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* Account settings */}
      <SectionHeading label="Account" />
      <Card pad={0}>
        {(
          [
            ['Display name', profile.display_name],
            ['Email', profile.email ?? '—'],
            ['Edition', edition.name],
            ['Notifications', 'Email · 2h before lock'],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--hair)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{k}</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
          </div>
        ))}
        <div style={{ padding: '12px 14px' }}>
          <SignOutButton />
        </div>
      </Card>
    </div>
  );
}
