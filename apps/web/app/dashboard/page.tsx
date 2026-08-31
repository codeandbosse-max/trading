'use client';

import {
  Activity,
  TrendingUp,
  TrendingDown,
  Radio,
  Plug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useStore } from '@/lib/store';
import { useMemo } from 'react';
import { formatCurrency, formatPercent, timeAgo, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const signalStatusMap: Record<string, { label: string; color: string }> = {
  accepte: { label: 'Accepté', color: 'text-success' },
  rejete: { label: 'Rejeté', color: 'text-destructive' },
  duplique: { label: 'Dupliqué', color: 'text-warning' },
  expire: { label: 'Expiré', color: 'text-muted-foreground' },
};

const orderStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  execute: { label: 'Exécuté', variant: 'default' },
  execute_partiellement: { label: 'Exéc. partiel', variant: 'default' },
  soumis: { label: 'Soumis', variant: 'secondary' },
  envoi_en_cours: { label: 'Envoi en cours', variant: 'secondary' },
  en_attente_validation: { label: 'En attente', variant: 'outline' },
  recu: { label: 'Reçu', variant: 'outline' },
  valide: { label: 'Validé', variant: 'secondary' },
  annule: { label: 'Annulé', variant: 'outline' },
  rejete: { label: 'Rejeté', variant: 'destructive' },
  erreur: { label: 'Erreur', variant: 'destructive' },
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && 'border-accent/30 bg-accent/5')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="font-mono-tnum text-2xl font-semibold tracking-tight">{value}</p>
            {sub && (
              <p
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  trend === 'up' && 'text-success',
                  trend === 'down' && 'text-destructive',
                  !trend && 'text-muted-foreground'
                )}
              >
                {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                {sub}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              accent ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const statusChartConfig: Record<string, { label: string; fill: string }> = {
  execute: { label: 'Exécuté', fill: 'hsl(var(--success))' },
  execute_partiellement: { label: 'Exéc. partiel', fill: 'hsl(var(--success))' },
  soumis: { label: 'Soumis', fill: 'hsl(var(--chart-5))' },
  envoi_en_cours: { label: 'Envoi', fill: 'hsl(var(--chart-5))' },
  en_attente_validation: { label: 'En attente', fill: 'hsl(var(--warning))' },
  recu: { label: 'Reçu', fill: 'hsl(var(--muted-foreground))' },
  valide: { label: 'Validé', fill: 'hsl(var(--chart-5))' },
  annule: { label: 'Annulé', fill: 'hsl(var(--muted-foreground))' },
  rejete: { label: 'Rejeté', fill: 'hsl(var(--destructive))' },
  erreur: { label: 'Erreur', fill: 'hsl(var(--muted-foreground))' },
};

export default function OverviewPage() {
  const { state, setLiveFeed, simulateSignal, liveFeed } = useStore();
  const { signalLogs, orders, connections, positions, killSwitch } = state;

  const recentSignals = signalLogs.slice(0, 6);
  const recentOrders = orders.slice(0, 5);
  const activeConnections = connections.filter((c) => c.status === 'actif').length;

  const stats = useMemo(() => {
    const accepted = signalLogs.filter((s) => s.status === 'accepte').length;
    const rejected = signalLogs.length - accepted;
    const pnlToday = positions.reduce((sum, p) => sum + p.pnl, 0);
    const equity = connections.reduce((sum, c) => sum + c.equity, 0);
    return {
      totalSignals: signalLogs.length,
      accepted,
      rejected,
      successRate: signalLogs.length === 0 ? 0 : (accepted / signalLogs.length) * 100,
      totalOrders: orders.length,
      openPositions: positions.length,
      pnlToday,
      equity,
    };
  }, [signalLogs, orders, positions, connections]);

  const signalsTimeline = useMemo(() => {
    const buckets = new Map<string, { hour: string; acceptes: number; rejetes: number }>();
    signalLogs.forEach((s) => {
      const hour = `${new Date(s.receivedAt).getHours().toString().padStart(2, '0')}h`;
      const bucket = buckets.get(hour) ?? { hour, acceptes: 0, rejetes: 0 };
      if (s.status === 'accepte') bucket.acceptes += 1;
      else bucket.rejetes += 1;
      buckets.set(hour, bucket);
    });
    return Array.from(buckets.values()).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [signalLogs]);

  const ordersByStatus = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((o) => counts.set(o.status, (counts.get(o.status) ?? 0) + 1));
    return Array.from(counts.entries()).map(([status, count]) => ({
      status: statusChartConfig[status]?.label ?? status,
      count,
      fill: statusChartConfig[status]?.fill ?? 'hsl(var(--muted-foreground))',
    }));
  }, [orders]);

  const pnlSeries = useMemo(() => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const buckets = new Map<string, number>();
    days.forEach((d) => buckets.set(d, 0));
    orders
      .filter((o) => o.status === 'execute' && o.executedAt && o.avgFillPrice !== null)
      .forEach((o) => {
        const day = days[new Date(o.executedAt as string).getDay()];
        const direction = o.side === 'achat' ? -1 : 1;
        buckets.set(day, (buckets.get(day) ?? 0) + direction * o.filledQty * (o.avgFillPrice ?? 0));
      });
    return days.map((day) => ({ day, pnl: Number((buckets.get(day) ?? 0).toFixed(2)) }));
  }, [orders]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vue d’ensemble</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            État en temps réel de vos signaux, ordres et connexions de courtage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={liveFeed ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLiveFeed(!liveFeed)}
          >
            <Activity className={cn('mr-2 h-4 w-4', liveFeed && 'animate-pulse')} />
            {liveFeed ? 'Flux actif' : 'Flux temps réel'}
          </Button>
          <Button variant="outline" size="sm" onClick={simulateSignal}>
            <Zap className="mr-2 h-4 w-4" />
            Signal de test
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/strategies">
              <Radio className="mr-2 h-4 w-4" />
              Nouvelle stratégie
            </Link>
          </Button>
        </div>
      </div>

      {/* Kill switch banner */}
      {killSwitch ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <Zap className="h-5 w-5" fill="currentColor" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Coupe-circuit actif</p>
              <p className="text-xs text-muted-foreground">
                Aucun ordre n’est transmis aux courtiers. Les signaux restent journalisés.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/risque">Gérer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <Zap className="h-5 w-5" fill="currentColor" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Coupe-circuit disponible</p>
              <p className="text-xs text-muted-foreground">
                En cas d’urgence, activez le coupe-circuit pour suspendre immédiatement tout envoi d’ordre réel.
              </p>
            </div>
            <Button variant="destructive" size="sm" asChild>
              <Link href="/dashboard/risque">Activer le coupe-circuit</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Signaux reçus"
          value={String(stats.totalSignals)}
          sub={`${stats.accepted} acceptés · ${stats.rejected} rejetés`}
          icon={Radio}
          trend="up"
        />
        <StatCard
          label="Taux de réussite"
          value={`${stats.successRate.toFixed(1)}%`}
          sub="Sur l’ensemble des signaux"
          icon={CheckCircle2}
          trend="up"
          accent
        />
        <StatCard
          label="Ordres au total"
          value={String(stats.totalOrders)}
          sub={`${stats.openPositions} positions ouvertes`}
          icon={Activity}
        />
        <StatCard
          label="P&L non réalisé"
          value={formatCurrency(stats.pnlToday)}
          sub={formatPercent(stats.equity === 0 ? 0 : (stats.pnlToday / stats.equity) * 100)}
          icon={TrendingUp}
          trend={stats.pnlToday >= 0 ? 'up' : 'down'}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Signals timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Signaux reçus par heure</CardTitle>
            <CardDescription>Acceptés vs rejetés sur les dernières 24 heures</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={signalsTimeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAccept" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReject" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="acceptes" name="Acceptés" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gradAccept)" />
                <Area type="monotone" dataKey="rejetes" name="Rejetés" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gradReject)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders by status pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des ordres</CardTitle>
            <CardDescription>Par statut d’exécution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={ordersByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {ordersByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* P&L chart + connections */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">P&L de la semaine</CardTitle>
            <CardDescription>Profit et perte réalisés par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pnlSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [formatCurrency(v), 'P&L']}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {pnlSeries.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Connections status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">État des connexions</CardTitle>
            <CardDescription>{activeConnections} connexions actives sur {connections.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {connections.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      c.status === 'actif' ? 'bg-success' : c.status === 'expire' ? 'bg-warning' : 'bg-destructive'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.broker} · {c.env}</p>
                  </div>
                </div>
                <Badge
                  variant={c.status === 'actif' ? 'default' : c.status === 'expire' ? 'outline' : 'destructive'}
                  className="text-[10px] capitalize"
                >
                  {c.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent signals + orders */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Signaux récents</CardTitle>
              <CardDescription>Derniers webhooks reçus</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/historique">
                Tout voir <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentSignals.map((s) => {
              const st = signalStatusMap[s.status];
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold uppercase',
                      s.action === 'buy' || s.action === 'cover' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    )}
                  >
                    {s.action === 'buy' ? 'B' : s.action === 'sell' ? 'S' : s.action === 'short' ? 'SH' : s.action === 'cover' ? 'C' : s.action === 'exit' ? 'E' : 'R'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {s.ticker} <span className="text-muted-foreground">· {s.strategyName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.source} · {timeAgo(s.receivedAt)}
                    </p>
                  </div>
                  <span className={cn('text-xs font-medium', st.color)}>{st.label}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Ordres récents</CardTitle>
              <CardDescription>Derniers ordres traités</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/ordres">
                Tout voir <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentOrders.map((o) => {
              const st = orderStatusMap[o.status];
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold uppercase',
                      o.side === 'achat' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    )}
                  >
                    {o.side === 'achat' ? 'A' : 'V'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {o.ticker} <span className="text-muted-foreground">· {o.quantity} @ {o.orderType}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.connectionName} · {formatTime(o.receivedAt)}
                    </p>
                  </div>
                  <Badge variant={st.variant} className="text-[10px]">
                    {st.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
