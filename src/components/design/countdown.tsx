'use client';
import { useEffect, useState } from 'react';
import { untilParts, type UntilParts } from './time';

export function Countdown({ iso }: { iso: string }) {
  const [parts, setParts] = useState<UntilParts>(() => untilParts(iso));
  useEffect(() => {
    const id = setInterval(() => setParts(untilParts(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  const cells: Array<[string, number]> = parts.d > 0
    ? [['d', parts.d], ['h', parts.h], ['m', parts.m]]
    : [['h', parts.h], ['m', parts.m], ['s', parts.s]];

  return (
    <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
      {cells.map(([k, v]) => (
        <div key={k} style={{
          background: 'var(--surface-alt)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
          padding: '8px 10px', minWidth: 48, textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600,
            color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
          }}>
            {String(v).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: 1, textTransform: 'uppercase' }}>{k}</div>
        </div>
      ))}
    </div>
  );
}
