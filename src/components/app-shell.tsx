'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/design/logo';
import { LiveDot } from '@/components/design/live-dot';
import { untilText } from '@/components/design/time';

const TABS: Array<{ href: string; label: string; icon: 'home' | 'picks' | 'board' | 'me' }> = [
  { href: '/home',  label: 'Home',  icon: 'home' },
  { href: '/picks', label: 'Picks', icon: 'picks' },
  { href: '/board', label: 'Board', icon: 'board' },
  { href: '/me',    label: 'Me',    icon: 'me' },
];

function NavIcon({ name, size = 22, color }: { name: 'home'|'picks'|'board'|'me'; size?: number; color: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':  return <svg {...common}><path d="M3 11 L12 3 L21 11" /><path d="M5 10 V21 H19 V10" /></svg>;
    case 'picks': return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 10 H16 M8 14 H13" /></svg>;
    case 'board': return <svg {...common}><path d="M4 20 V10 M10 20 V4 M16 20 V14 M22 20 H2" /></svg>;
    case 'me':    return <svg {...common}><circle cx="12" cy="9" r="4" /><path d="M4 20 C5 15 19 15 20 20" /></svg>;
  }
}

export function AppShell({ children, nextStageLabel, nextStageIso }: {
  children: ReactNode;
  nextStageLabel?: string;
  nextStageIso?: string;
}) {
  const pathname = usePathname();
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 880px)');
    const handle = () => setIsWide(mql.matches);
    handle();
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, []);

  const [untilLabel, setUntilLabel] = useState(() => (nextStageIso ? untilText(nextStageIso) : ''));
  useEffect(() => {
    if (!nextStageIso) return;
    const id = setInterval(() => setUntilLabel(untilText(nextStageIso)), 60_000);
    return () => clearInterval(id);
  }, [nextStageIso]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--hair)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)' }}>
            <Logo />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, letterSpacing: -0.3 }}>Quiniela</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: 1, marginTop: 3 }}>GIRO · MMXXVI</span>
            </span>
          </Link>
          {nextStageLabel && nextStageIso && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LiveDot />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
                {nextStageLabel} locks in {untilLabel}
              </div>
            </div>
          )}
        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: isWide ? '280px 1fr' : '1fr', maxWidth: 1180, margin: '0 auto', width: '100%' }}>
        {isWide && (
          <aside style={{ borderRight: '1px solid var(--hair)', padding: '24px 20px', position: 'sticky', top: 61, alignSelf: 'start', height: 'calc(100vh - 61px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TABS.map((t) => {
                const active = pathname === t.href || (t.href === '/picks' && pathname.startsWith('/picks'));
                return (
                  <Link key={t.href} href={t.href} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--ink)',
                    padding: '10px 12px', borderRadius: 'var(--radius)',
                    fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  }}>
                    <NavIcon name={t.icon} color={active ? 'var(--accent)' : 'var(--ink-soft)'} size={18} />
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </aside>
        )}
        <div style={{ padding: isWide ? '28px 32px 120px' : '0 0 90px', minWidth: 0 }}>
          {children}
        </div>
      </main>

      {!isWide && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderTop: '1px solid var(--hair)',
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', zIndex: 20,
        }}>
          {TABS.map((t) => {
            const active = pathname === t.href || (t.href === '/picks' && pathname.startsWith('/picks'));
            return (
              <Link key={t.href} href={t.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 0', color: active ? 'var(--accent)' : 'var(--ink-soft)',
                textDecoration: 'none',
              }}>
                <NavIcon name={t.icon} color={active ? 'var(--accent)' : 'var(--ink-soft)'} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
