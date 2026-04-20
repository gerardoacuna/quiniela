import type { CSSProperties, ReactNode } from 'react';

export function Card({ children, pad = 16, style }: {
  children: ReactNode; pad?: number; style?: CSSProperties;
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--radius)',
      padding: pad,
      ...style,
    }}>
      {children}
    </div>
  );
}
