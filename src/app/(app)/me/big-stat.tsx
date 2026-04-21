export function BigStat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--ink-mute)',
          letterSpacing: 1.2,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
          fontWeight: mono ? 700 : 600,
          fontSize: 22,
          lineHeight: 1.1,
          marginTop: 4,
          color: 'var(--ink)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
