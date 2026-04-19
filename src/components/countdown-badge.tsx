'use client';

import { useEffect, useState } from 'react';

function format(ms: number): string {
  if (ms <= 0) return 'locked';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function CountdownBadge({ targetIso }: { targetIso: string }) {
  const [remaining, setRemaining] = useState(() => new Date(targetIso).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRemaining(new Date(targetIso).getTime() - Date.now()), 30_000);
    return () => clearInterval(id);
  }, [targetIso]);
  return <span className="font-mono text-xl">{format(remaining)}</span>;
}
