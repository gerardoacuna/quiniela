import { Card } from '@/components/design/card';

export function BoardSectionSkeleton() {
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
          Loading…
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderTop: '1px solid var(--hair)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: 'var(--hair)',
              borderRadius: 6,
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                width: '40%',
                height: 11,
                background: 'var(--hair)',
                borderRadius: 4,
              }}
            />
            <div
              style={{
                width: '20%',
                height: 9,
                background: 'var(--hair)',
                borderRadius: 4,
                marginTop: 6,
              }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}
