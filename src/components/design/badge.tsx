import type { CSSProperties, ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'soft' | 'muted' | 'ok' | 'warn' | 'danger' | 'outline';
type Size = 'xs' | 'sm' | 'md';

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  default: { bg: 'var(--surface-alt)', fg: 'var(--ink)',        bd: 'var(--hair)' },
  accent:  { bg: 'var(--accent)',      fg: 'var(--accent-ink)', bd: 'var(--accent)' },
  soft:    { bg: 'var(--accent-soft)', fg: 'var(--accent)',     bd: 'var(--accent-soft)' },
  muted:   { bg: 'transparent',        fg: 'var(--ink-mute)',   bd: 'var(--hair)' },
  ok:      { bg: 'transparent',        fg: 'var(--ok)',         bd: 'var(--ok)' },
  warn:    { bg: 'transparent',        fg: 'var(--warn)',       bd: 'var(--warn)' },
  danger:  { bg: 'var(--accent)',      fg: 'var(--accent-ink)', bd: 'var(--accent)' },
  outline: { bg: 'transparent',        fg: 'var(--ink)',        bd: 'var(--hair)' },
};

const SIZES: Record<Size, { fs: number; pad: string }> = {
  xs: { fs: 10, pad: '2px 6px' },
  sm: { fs: 11, pad: '3px 8px' },
  md: { fs: 12, pad: '4px 10px' },
};

export function Badge({ children, tone = 'default', size = 'sm', style }: {
  children: ReactNode; tone?: Tone; size?: Size; style?: CSSProperties;
}) {
  const s = TONES[tone];
  const z = SIZES[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: z.fs, fontWeight: 600, letterSpacing: 0.3,
      padding: z.pad, borderRadius: 999,
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
      textTransform: 'uppercase', ...style,
    }}>
      {children}
    </span>
  );
}
