export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--radius)',
      background: 'var(--accent)', color: 'var(--accent-ink)',
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size * 0.5, letterSpacing: -0.5,
    }}>Q</div>
  );
}
