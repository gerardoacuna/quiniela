import type { ReactNode } from 'react';

export function SectionTitle({ eyebrow, title, right }: {
  eyebrow?: string; title: string; right?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
      <div>
        {eyebrow && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
            color: 'var(--ink-mute)', marginBottom: 4, fontFamily: 'var(--font-mono)',
          }}>{eyebrow}</div>
        )}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontStyle: 'normal',
          fontSize: 22, lineHeight: 1.1, color: 'var(--ink)',
          letterSpacing: -0.3,
        }}>{title}</div>
      </div>
      {right}
    </div>
  );
}
