'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  Webhook,
  ListOrdered,
  Plug,
  ShieldAlert,
  Wallet,
  History,
  Bell,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';

const navItems = [
  { href: '/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { href: '/dashboard/strategies', label: 'Stratégies', icon: Radio },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dashboard/ordres', label: 'Ordres', icon: ListOrdered },
  { href: '/dashboard/connexions', label: 'Connexions', icon: Plug },
  { href: '/dashboard/positions', label: 'Positions', icon: Wallet },
  { href: '/dashboard/risque', label: 'Risque', icon: ShieldAlert },
  { href: '/dashboard/historique', label: 'Historique', icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const { state } = useStore();
  const killSwitchActive = state.killSwitch;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Zap className="h-5 w-5" fill="currentColor" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">SignalDesk</span>
          <span className="text-[11px] text-muted-foreground">Automatisation de trading</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2.5 text-xs',
            killSwitchActive
              ? 'bg-destructive/10 text-destructive'
              : 'bg-success/10 text-success'
          )}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-pulse-dot rounded-full opacity-75',
                killSwitchActive ? 'bg-destructive' : 'bg-success'
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                killSwitchActive ? 'bg-destructive' : 'bg-success'
              )}
            />
          </span>
          <span className="font-medium">
            {killSwitchActive ? 'Coupe-circuit ACTIF' : 'Système opérationnel'}
          </span>
        </div>
      </div>
    </aside>
  );
}
