'use client';
import type { CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, { bg: string; fg: string; bd: string }> = {
  primary: { bg: 'var(--ink)',        fg: 'var(--bg)',         bd: 'var(--ink)' },
  accent:  { bg: 'var(--accent)',     fg: 'var(--accent-ink)', bd: 'var(--accent)' },
  ghost:   { bg: 'transparent',       fg: 'var(--ink)',        bd: 'var(--hair)' },
  danger:  { bg: 'transparent',       fg: 'var(--danger)',     bd: 'var(--danger)' },
  quiet:   { bg: 'var(--surface-alt)',fg: 'var(--ink)',        bd: 'var(--hair)' },
};

const SIZES: Record<Size, { fs: number; pad: string; minH: number }> = {
  sm: { fs: 13, pad: '8px 12px', minH: 34 },
  md: { fs: 14, pad: '11px 16px', minH: 42 },
  lg: { fs: 15, pad: '14px 20px', minH: 50 },
};

export function DsButton({
  children, onClick, variant = 'primary', size = 'md',
  disabled, full, type = 'button', style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant; size?: Size;
  disabled?: boolean; full?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  const v = VARIANTS[variant];
  const z = SIZES[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: v.bg, color: v.fg, border: `1px solid ${v.bd}`,
        padding: z.pad, borderRadius: 'var(--radius)',
        fontWeight: 600, fontSize: z.fs, fontFamily: 'var(--font-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        minHeight: z.minH,
        width: full ? '100%' : 'auto',
        transition: 'transform 80ms ease, background 120ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
