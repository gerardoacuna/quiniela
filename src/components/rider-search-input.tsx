'use client';

import type { CSSProperties } from 'react';

type RiderLike = {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
};

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function filterRidersByQuery<T extends RiderLike>(riders: T[], query: string): T[] {
  const q = fold(query.trim());
  if (!q) return riders;
  return riders.filter(
    (r) =>
      fold(r.name).includes(q) ||
      fold(r.team ?? '').includes(q) ||
      (r.bib != null && String(r.bib).includes(q)),
  );
}

export function RiderSearchInput({
  value,
  onChange,
  placeholder = 'Search name, team, bib…',
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
        ...style,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ink-mute)"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M16 16 L21 21" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search riders"
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--ink)',
          flex: 1,
          fontSize: 14,
          fontFamily: 'var(--font-body)',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink-mute)',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
