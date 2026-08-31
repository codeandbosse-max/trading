'use client';

import {
  History,
  Shield,
  Info,
  AlertTriangle,
  AlertOctagon,
  Download,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { toCsv, downloadCsv } from '@/lib/export';
import { type AuditLog } from '@/lib/mock-data';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const severityConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  info: { label: 'Info', color: 'text-chart-5', bg: 'bg-chart-5/10', icon: Info },
  warning: { label: 'Avertissement', color: 'text-warning', bg: 'bg-warning/10', icon: AlertTriangle },
  critical: { label: 'Critique', color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertOctagon },
};

const signalStatusMap: Record<string, { label: string; color: string }> = {
  accepte: { label: 'Accepté', color: 'text-success' },
  rejete: { label: 'Rejeté', color: 'text-destructive' },
  duplique: { label: 'Dupliqué', color: 'text-warning' },
  expire: { label: 'Expiré', color: 'text-muted-foreground' },
};

export default function HistoryPage() {
  const { state } = useStore();
  const { auditLogs, signalLogs } = state;
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filtered = auditLogs.filter((l) => {
    const matchSearch =
      !search ||
      l.actor.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === 'all' || l.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  const exportAudit = () => {
    const csv = toCsv(filtered, ['timestamp', 'severity', 'actor', 'action', 'target', 'ip']);
    downloadCsv(`journal-audit-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success('Journal exporté', { description: `${filtered.length} entrée(s).` });
  };

  const exportSignals = () => {
    const csv = toCsv(signalLogs, [
      'receivedAt',
      'signalId',
      'ticker',
      'action',
      'strategyName',
      'source',
      'status',
      'reason',
      'subscriptionsTargeted',
    ]);
    downloadCsv(`signaux-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success('Signaux exportés', { description: `${signalLogs.length} entrée(s).` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historique</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Journal d’audit immuable, signaux reçus et événements système.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportAudit} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exporter le journal
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans le journal d’audit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sévérités</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Avertissement</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-accent" />
            Journal d’audit
          </CardTitle>
          <CardDescription>
            Enregistrement append-only des connexions, configurations et actions sensibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {filtered.map((log: AuditLog) => {
            const st = severityConfig[log.severity];
            const Icon = st.icon;
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-md px-2 py-3 hover:bg-muted/40"
              >
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', st.bg)}>
                  <Icon className={cn('h-4 w-4', st.color)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{log.action}</p>
                    <Badge variant="outline" className={cn('text-[10px]', st.color, 'border-current/20')}>
                      {st.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {log.target} · par <span className="font-medium">{log.actor}</span>
                  </p>
                  {log.ip !== '—' && (
                    <p className="text-[11px] text-muted-foreground">IP: {log.ip}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune entrée ne correspond à vos filtres.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signal history */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-accent" />
              Historique des signaux
            </CardTitle>
            <CardDescription>
              Tous les webhooks reçus, leur statut et leur motif de rejet éventuel.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportSignals} disabled={signalLogs.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {signalLogs.map((s) => {
            const st = signalStatusMap[s.status];
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/40"
              >
                <Badge variant="outline" className="text-[10px] uppercase">
                  {s.action}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {s.ticker} <span className="text-muted-foreground">· {s.strategyName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.signalId} · {s.source}
                  </p>
                  {s.reason && (
                    <p className={cn('mt-0.5 text-xs', st.color)}>{s.reason}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={cn('text-xs font-medium', st.color)}>{st.label}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDateTime(s.receivedAt)}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
