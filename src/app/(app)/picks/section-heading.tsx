import type { ReactNode } from 'react';

export function SectionHeading({
  label,
  right,
}: {
  label: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.8,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      {right}
    </div>
  );
}
