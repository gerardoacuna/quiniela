export type JerseyKind = 'points' | 'white';

export function JerseyGlyph({
  size = 22,
  kind = 'points',
}: { size?: number; kind?: JerseyKind }) {
  const background = kind === 'white' ? 'var(--jersey-white)' : 'var(--jersey-pink)';
  const innerBorder = kind === 'white' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.5)';
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: 4, flex: 'none',
        background, position: 'relative',
        border: '1px solid rgba(0,0,0,0.15)',
      }}
    >
      <span style={{
        position: 'absolute', inset: 2,
        border: `1px solid ${innerBorder}`, borderRadius: 2,
      }} />
    </div>
  );
}
