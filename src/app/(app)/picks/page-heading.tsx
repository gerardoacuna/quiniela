import type { ReactNode } from 'react';

export function PageHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
}) {
  return (
    <div style={{ padding: '4px 0' }}>
      {eyebrow && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 1.4,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        style={{
          margin: '2px 0 2px',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 36,
          lineHeight: 1.05,
          letterSpacing: -0.5,
          color: 'var(--ink)',
        }}
      >
        {title}
      </h1>
      {sub && (
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}
