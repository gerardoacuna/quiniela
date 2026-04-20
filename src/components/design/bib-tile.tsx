export function BibTile({ num, size = 36 }: { num: number | null | undefined; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size * 1.2, borderRadius: 'var(--radius)',
        background: '#fff', color: '#1a1714',
        border: '1px solid var(--hair)',
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: size * 0.42,
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.04)',
      }}
    >
      {num ?? '—'}
    </div>
  );
}
