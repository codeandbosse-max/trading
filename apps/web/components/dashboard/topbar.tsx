'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  ChevronDown,
  Radio,
  ListOrdered,
  Plug,
  Wallet,
  CheckCheck,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useStore } from '@/lib/store';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const severityColor: Record<string, string> = {
  info: 'bg-chart-5/15 text-chart-5',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-destructive/15 text-destructive',
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const { state, markNotificationRead, markAllNotificationsRead, user, logout } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifications = state.notifications;
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((p) => !p);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo(
    () => ({
      strategies: state.strategies.slice(0, 5),
      orders: state.orders.slice(0, 5),
      connections: state.connections.slice(0, 5),
      positions: state.positions.slice(0, 5),
    }),
    [state.strategies, state.orders, state.connections, state.positions]
  );

  const go = (href: string) => {
    setSearchOpen(false);
    router.push(href);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="relative hidden flex-1 max-w-md sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          readOnly
          onClick={() => setSearchOpen(true)}
          placeholder="Rechercher un signal, un ordre, une stratégie…"
          className="h-9 cursor-pointer bg-muted/50 pl-9"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground md:block">
          Ctrl K
        </kbd>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-initial">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Changer de thème">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotifOpen((p) => !p)}
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread}
              </span>
            )}
          </Button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotifOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-80 animate-fade-in rounded-lg border border-border bg-popover p-2 shadow-xl">
                <div className="flex items-center justify-between px-2 py-2">
                  <span className="text-sm font-semibold">Notifications</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {unread} non lues
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={markAllNotificationsRead}
                      aria-label="Tout marquer comme lu"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
                  {notifications.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Aucune notification.
                    </p>
                  )}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className={cn(
                        'flex w-full gap-3 rounded-md p-2.5 text-left hover:bg-muted/50',
                        !n.read && 'bg-muted/30'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          severityColor[n.severity].split(' ')[0]
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {timeAgo(n.timestamp)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            {(user?.name ?? '?')
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-xs font-medium">{user?.name ?? '—'}</span>
            <span className="text-[11px] capitalize text-muted-foreground">
              {user?.role ?? ''}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => void logout()}
            aria-label="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Rechercher une stratégie, un ordre, une connexion…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup heading="Stratégies">
            {results.strategies.map((s) => (
              <CommandItem key={s.id} value={`${s.name} ${s.webhookId}`} onSelect={() => go('/dashboard/strategies')}>
                <Radio className="mr-2 h-4 w-4" />
                {s.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Ordres">
            {results.orders.map((o) => (
              <CommandItem
                key={o.id}
                value={`${o.ticker} ${o.signalId} ${o.strategyName}`}
                onSelect={() => go('/dashboard/ordres')}
              >
                <ListOrdered className="mr-2 h-4 w-4" />
                {o.ticker} · {o.quantity} · {o.strategyName}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Connexions">
            {results.connections.map((c) => (
              <CommandItem key={c.id} value={`${c.name} ${c.broker}`} onSelect={() => go('/dashboard/connexions')}>
                <Plug className="mr-2 h-4 w-4" />
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Positions">
            {results.positions.map((p) => (
              <CommandItem key={p.id} value={`${p.ticker} ${p.connectionName}`} onSelect={() => go('/dashboard/positions')}>
                <Wallet className="mr-2 h-4 w-4" />
                {p.ticker} · {p.qty} ({p.side})
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
