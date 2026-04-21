'use client';

import { Card } from '@/components/design/card';
import { PageHeading } from '@/app/(app)/picks/page-heading';
import type { RankedLeaderboardRow } from '@/lib/scoring';

interface BoardClientProps {
  rows: RankedLeaderboardRow[];
  currentUserId: string;
}

export function BoardClient({ rows, currentUserId }: BoardClientProps) {
  const me = rows.find((r) => r.user_id === currentUserId) ?? null;
  const max = Math.max(...rows.map((r) => r.total_points), 0);

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeading
        eyebrow={`Leaderboard · ${rows.length} player${rows.length !== 1 ? 's' : ''}`}
        title="Classifica"
        sub="Sorted by total points · ties broken by exact winners."
      />

      {rows.length === 0 ? (
        <Card>
          <div style={{ fontSize: 14, color: 'var(--ink-mute)', textAlign: 'center', padding: '20px 0' }}>
            No players yet.
          </div>
        </Card>
      ) : (
        <Card pad={0}>
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr 54px 44px 54px',
              gap: 10,
              padding: '10px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 1.2,
              color: 'var(--ink-mute)',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--hair)',
            }}
          >
            <span>#</span>
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>Stage</span>
            <span style={{ textAlign: 'right' }}>★</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>

          {/* Body rows */}
          {rows.map((r) => {
            const isMe = r.user_id === currentUserId;
            const pct = max > 0 ? r.total_points / max : 0;
            return (
              <div
                key={r.user_id}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 54px 44px 54px',
                  gap: 10,
                  padding: '10px 14px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--hair)',
                  background: isMe ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: 13,
                    color: isMe ? 'var(--accent)' : 'var(--ink-soft)',
                  }}
                >
                  {r.rank}
                </span>

                <div style={{ position: 'relative', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isMe ? 700 : 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {isMe ? 'You' : r.display_name}
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      height: 3,
                      background: 'var(--hair)',
                      borderRadius: 2,
                      marginTop: 4,
                      overflow: 'hidden',
                      maxWidth: 160,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct * 100}%`,
                        height: '100%',
                        background: isMe ? 'var(--accent)' : 'var(--ink)',
                        opacity: isMe ? 1 : 0.7,
                      }}
                    />
                  </div>
                </div>

                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--ink-soft)',
                    textAlign: 'right',
                  }}
                >
                  {r.stage_points}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--ink-soft)',
                    textAlign: 'right',
                  }}
                >
                  {r.exact_winners_count}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    textAlign: 'right',
                  }}
                >
                  {r.total_points}
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {/* Sticky "your rank" summary */}
      {me && (
        <div
          style={{
            position: 'sticky',
            bottom: 86,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 1.4,
                opacity: 0.8,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              Your rank
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 22,
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              #{me.rank} of {rows.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 10,
                  opacity: 0.8,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Points
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20 }}>
                {me.total_points}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 10,
                  opacity: 0.8,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                ★
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20 }}>
                {me.exact_winners_count}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
