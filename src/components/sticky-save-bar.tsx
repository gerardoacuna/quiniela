import type { ReactNode, CSSProperties } from 'react';

export function StickyActionBar({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 'calc(var(--bottom-nav-h, 0px) + 16px)',
        background: 'var(--bg)',
        paddingTop: 8,
        marginTop: 4,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
