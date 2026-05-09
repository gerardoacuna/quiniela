'use client';

import { useState, type ReactNode } from 'react';

type Tab = 'by-participant' | 'by-rider';

interface Props {
  participantsView: ReactNode;
  ridersView: ReactNode;
}

export function RevealTabs({ participantsView, ridersView }: Props) {
  const [tab, setTab] = useState<Tab>('by-participant');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        role="tablist"
        aria-label="Reveal view"
        style={{
          display: 'inline-flex',
          padding: 3,
          borderRadius: 999,
          background: 'var(--surface-alt)',
          border: '1px solid var(--hair)',
          alignSelf: 'flex-start',
          gap: 2,
        }}
      >
        <TabButton
          active={tab === 'by-participant'}
          onClick={() => setTab('by-participant')}
          label="By participant"
        />
        <TabButton
          active={tab === 'by-rider'}
          onClick={() => setTab('by-rider')}
          label="By rider"
        />
      </div>

      {tab === 'by-participant' ? participantsView : ridersView}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 12px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        fontWeight: active ? 700 : 500,
        background: active ? 'var(--ink)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--ink-soft)',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {label}
    </button>
  );
}
