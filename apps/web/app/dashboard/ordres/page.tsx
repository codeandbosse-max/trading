'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  ListOrdered,
  Filter,
  Check,
  X,
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Download,
  RotateCcw,
  Ban,
} from 'lucide-react';
import {
  Card,
  CardContent,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useStore } from '@/lib/store';
import { toCsv, downloadCsv } from '@/lib/export';
import { type OrderStatus } from '@/lib/mock-data';
import { formatCurrency, formatDateTime, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const statusConfig: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType; color: string }> = {
  execute: { label: 'Exécuté', variant: 'default', icon: CheckCircle2, color: 'text-success' },
  execute_partiellement: { label: 'Exéc. partiel', variant: 'default', icon: CheckCircle2, color: 'text-success' },
  soumis: { label: 'Soumis', variant: 'secondary', icon: ArrowRight, color: 'text-chart-5' },
  envoi_en_cours: { label: 'Envoi en cours', variant: 'secondary', icon: Loader2, color: 'text-chart-5' },
  en_attente_validation: { label: 'En attente', variant: 'outline', icon: Clock, color: 'text-warning' },
  recu: { label: 'Reçu', variant: 'outline', icon: MinusCircle, color: 'text-muted-foreground' },
  valide: { label: 'Validé', variant: 'secondary', icon: Check, color: 'text-chart-5' },
  annule: { label: 'Annulé', variant: 'outline', icon: X, color: 'text-muted-foreground' },
  rejete: { label: 'Rejeté', variant: 'destructive', icon: XCircle, color: 'text-destructive' },
  erreur: { label: 'Erreur', variant: 'destructive', icon: AlertCircle, color: 'text-destructive' },
};

const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'execute', label: 'Exécutés' },
  { value: 'en_attente_validation', label: 'En attente' },
  { value: 'soumis', label: 'Soumis' },
  { value: 'rejete', label: 'Rejetés' },
  { value: 'erreur', label: 'Erreurs' },
];

export default function OrdersPage() {
  const { state, approveOrder, rejectOrder, cancelOrder, retryOrder } = useStore();
  const orders = state.orders;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !search ||
        o.ticker.toLowerCase().includes(search.toLowerCase()) ||
        o.strategyName.toLowerCase().includes(search.toLowerCase()) ||
        o.connectionName.toLowerCase().includes(search.toLowerCase()) ||
        o.signalId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  const exportOrders = () => {
    const csv = toCsv(filtered, [
      'id',
      'signalId',
      'ticker',
      'side',
      'quantity',
      'orderType',
      'status',
      'strategyName',
      'connectionName',
      'filledQty',
      'avgFillPrice',
      'receivedAt',
      'executedAt',
    ]);
    downloadCsv(`ordres-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success('Export terminé', { description: `${filtered.length} ordre(s) exporté(s).` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ordres</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi complet du cycle de vie des ordres, de la réception à l’exécution.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportOrders} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exporter (CSV)
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrer par ticker, stratégie, compte, signal…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ticker</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sens</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Qté</th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Type</th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Stratégie</th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Compte</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut</th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Heure</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const st = statusConfig[o.status];
                  const StatusIcon = st.icon;
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/40"
                      onClick={() => setSelectedId(o.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{o.ticker}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                            o.side === 'achat' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {o.side === 'achat' ? 'Achat' : 'Vente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono-tnum text-xs">{o.quantity}</td>
                      <td className="hidden px-4 py-3 text-xs capitalize text-muted-foreground md:table-cell">{o.orderType}</td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{o.strategyName}</td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{o.connectionName}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <StatusIcon className={cn('h-3.5 w-3.5', st.color, o.status === 'envoi_en_cours' && 'animate-spin')} />
                          <span className={cn('text-xs font-medium', st.color)}>{st.label}</span>
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{formatTime(o.receivedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun ordre ne correspond à vos filtres.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order detail */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="overflow-y-auto scrollbar-thin sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      selected.side === 'achat' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    )}
                  >
                    <ListOrdered className="h-5 w-5" />
                  </div>
                  <div>
                    <SheetTitle>{selected.ticker}</SheetTitle>
                    <SheetDescription>
                      {selected.side === 'achat' ? 'Achat' : 'Vente'} · {selected.quantity} unités
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 p-6">
                {/* Status banner */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Statut</p>
                    <Badge variant={statusConfig[selected.status].variant} className="mt-1 text-xs">
                      {statusConfig[selected.status].label}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase text-muted-foreground">ID interne</p>
                    <p className="font-mono text-xs">{selected.id}</p>
                  </div>
                </div>

                {/* Rejection reason */}
                {selected.rejectionReason && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Motif du rejet / erreur
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{selected.rejectionReason}</p>
                  </div>
                )}

                {/* Order details */}
                <div className="space-y-2.5 rounded-lg border border-border p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signal</span>
                    <span className="font-mono text-xs">{selected.signalId}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Action</span>
                    <span className="font-medium capitalize">{selected.action}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type d’ordre</span>
                    <span className="font-medium capitalize">{selected.orderType}</span>
                  </div>
                  {selected.limitPrice !== null && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prix limite</span>
                        <span className="font-mono-tnum font-medium">{formatCurrency(selected.limitPrice)}</span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durée de validité</span>
                    <span className="font-medium uppercase">{selected.timeInForce}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stratégie</span>
                    <span className="font-medium">{selected.strategyName}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Compte cible</span>
                    <span className="font-medium">{selected.connectionName}</span>
                  </div>
                </div>

                {/* Execution details */}
                {selected.brokerOrderId && (
                  <div className="space-y-2.5 rounded-lg border border-border p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID broker</span>
                      <span className="font-mono text-xs">{selected.brokerOrderId}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Qté exécutée</span>
                      <span className="font-mono-tnum font-medium">{selected.filledQty} / {selected.quantity}</span>
                    </div>
                    {selected.avgFillPrice !== null && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prix moyen</span>
                          <span className="font-mono-tnum font-medium">{formatCurrency(selected.avgFillPrice)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Chronologie</h4>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-accent" />
                      <div>
                        <p className="text-xs font-medium">Reçu</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(selected.receivedAt)}</p>
                      </div>
                    </div>
                    {selected.submittedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-chart-5" />
                        <div>
                          <p className="text-xs font-medium">Soumis au broker</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(selected.submittedAt)}</p>
                        </div>
                      </div>
                    )}
                    {selected.executedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-success" />
                        <div>
                          <p className="text-xs font-medium">Exécuté</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(selected.executedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {selected.status === 'en_attente_validation' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                        onClick={() => {
                          approveOrder(selected.id);
                          toast.success('Ordre approuvé', { description: selected.ticker });
                        }}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approuver
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          rejectOrder(selected.id, 'Rejet manuel par l’opérateur.');
                          toast.success('Ordre rejeté', { description: selected.ticker });
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Rejeter
                      </Button>
                    </div>
                  )}

                  {['soumis', 'envoi_en_cours', 'valide', 'recu'].includes(selected.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        cancelOrder(selected.id);
                        toast.success('Ordre annulé', { description: selected.ticker });
                      }}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Annuler l’ordre
                    </Button>
                  )}

                  {['rejete', 'erreur', 'annule'].includes(selected.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        retryOrder(selected.id);
                        toast.success('Ordre renvoyé au broker', { description: selected.ticker });
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Réessayer
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
