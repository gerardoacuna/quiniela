'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/edition', label: 'Edition' },
  { href: '/admin/stages', label: 'Stages' },
  { href: '/admin/classifications', label: 'Final classifications' },
  { href: '/admin/riders', label: 'Riders' },
  { href: '/admin/roster', label: 'Roster' },
  { href: '/admin/invites', label: 'Invites' },
  { href: '/admin/errors', label: 'Errors & audit' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="md:w-56 md:border-r md:h-screen p-3 border-b bg-muted/30">
      <div className="font-semibold pb-3 px-2">Admin</div>
      <ul className="flex md:flex-col gap-1 overflow-x-auto">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <li key={it.href} className="shrink-0">
              <Link
                href={it.href}
                className={`block whitespace-nowrap rounded px-3 py-2 text-sm ${
                  active ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                }`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
