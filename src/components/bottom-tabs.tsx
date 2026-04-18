'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, List, Trophy, User } from 'lucide-react';

const tabs = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/picks', label: 'Picks', Icon: List },
  { href: '/board', label: 'Board', Icon: Trophy },
  { href: '/me', label: 'Me', Icon: User },
];

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ul className="mx-auto max-w-md grid grid-cols-4">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center py-3 text-xs ${
                  active ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
