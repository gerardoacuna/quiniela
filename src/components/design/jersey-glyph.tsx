export function JerseyGlyph({ size = 22 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: 4, flex: 'none',
        background: 'var(--jersey-pink)', position: 'relative',
        border: '1px solid rgba(0,0,0,0.15)',
      }}
    >
      <span style={{
        position: 'absolute', inset: 2,
        border: '1px solid rgba(255,255,255,0.5)', borderRadius: 2,
      }} />
    </div>
  );
}
