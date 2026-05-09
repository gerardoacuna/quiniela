import { Card } from '@/components/design/card';
import { BibTile } from '@/components/design/bib-tile';
import { ordinal } from '@/components/design/time';
import { pointsForFinish } from '@/lib/scoring';
import type { StageDetailData } from '@/lib/queries/stage-detail';

export type Picker = { name: string; kind: 'primary' | 'underdog' };
export type GroupedPick = {
  rider: StageDetailData['allPicks'][number]['rider'];
  pickers: Picker[];
};

interface Props {
  grouped: GroupedPick[];
  scored: boolean;
  resultsMap: Map<string, number>;
  doublePoints: boolean;
}

export function WhoPickedWhomCard({ grouped, scored, resultsMap, doublePoints }: Props) {
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
          const pos = resultsMap.get(g.rider.id) ?? null;
          const pts = pointsForFinish(pos, doublePoints);
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
                  {g.pickers.length} picker{g.pickers.length === 1 ? '' : 's'}
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
                {g.pickers.slice(0, 12).map((p, i) => (
                  <span
                    key={`${p.name}-${p.kind}-${i}`}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: 'var(--surface-alt)',
                      color: p.name === 'You' ? 'var(--accent)' : 'var(--ink-soft)',
                      fontWeight: p.name === 'You' ? 700 : 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {p.name}
                    {p.kind === 'underdog' && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: 0.6,
                          color: 'var(--ink-mute)',
                          textTransform: 'uppercase',
                        }}
                      >
                        · underdog
                      </span>
                    )}
                  </span>
                ))}
                {g.pickers.length > 12 && (
                  <span style={{ fontSize: 10, padding: '2px 6px', color: 'var(--ink-mute)' }}>
                    +{g.pickers.length - 12}
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
