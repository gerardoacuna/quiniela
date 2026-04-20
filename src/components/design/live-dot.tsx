export function LiveDot({ size = 7 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: size, height: size, borderRadius: 999, background: 'var(--accent)',
        boxShadow: '0 0 0 4px var(--accent-soft)',
        animation: 'qpulse 1.8s ease-out infinite',
      }} />
    </span>
  );
}
