'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  XCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStore } from '@/lib/store';
import { toCsv, downloadCsv } from '@/lib/export';
import type { Position } from '@trading/shared';
import { formatCurrency, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function PositionsPage() {
  const { state, closePosition } = useStore();
  const positions = state.positions;
  const [pendingClose, setPendingClose] = useState<Position | null>(null);

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const winners = positions.filter((p) => p.pnl > 0).length;
  const losers = positions.filter((p) => p.pnl < 0).length;

  const exportPositions = () => {
    const csv = toCsv(positions, [
      'ticker',
      'side',
      'qty',
      'avgPrice',
      'currentPrice',
      'marketValue',
      'pnl',
      'pnlPercent',
      'connectionName',
    ]);
    downloadCsv(`positions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success('Export terminé', { description: `${positions.length} position(s).` });
  };

  const confirmClose = async () => {
    if (!pendingClose) return;
    await closePosition(pendingClose.id);
    toast.success('Position clôturée', { description: pendingClose.ticker });
    setPendingClose(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Positions ouvertes, prix moyen, P&L et exposition par compte.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportPositions} disabled={positions.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exporter (CSV)
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Valeur totale</p>
            <p className="mt-1 font-mono-tnum text-2xl font-semibold">{formatCurrency(totalValue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{positions.length} positions ouvertes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">P&L non réalisé</p>
            <p className={cn('mt-1 font-mono-tnum text-2xl font-semibold', totalPnl >= 0 ? 'text-success' : 'text-destructive')}>
              {totalPnl >= 0 ? '+' : '−'}{formatCurrency(Math.abs(totalPnl))}
            </p>
            <p className={cn('mt-1 text-xs', totalPnl >= 0 ? 'text-success' : 'text-destructive')}>
              {formatPercent(totalValue === 0 ? 0 : (totalPnl / totalValue) * 100)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Gagnantes</p>
            <p className="mt-1 font-mono-tnum text-2xl font-semibold text-success">{winners}</p>
            <p className="mt-1 text-xs text-muted-foreground">Positions en profit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Perdantes</p>
            <p className="mt-1 font-mono-tnum text-2xl font-semibold text-destructive">{losers}</p>
            <p className="mt-1 text-xs text-muted-foreground">Positions en perte</p>
          </CardContent>
        </Card>
      </div>

      {/* Positions table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-accent" />
            Positions ouvertes
          </CardTitle>
          <CardDescription>Vue consolidée par compte et par instrument</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ticker</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sens</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Qté</th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Prix moyen</th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Prix actuel</th>
                  <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Compte</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Valeur</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">P&L</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">{p.ticker}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          p.side === 'long' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        )}
                      >
                        {p.side === 'long' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {p.side === 'long' ? 'Long' : 'Short'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-tnum text-xs">{p.qty}</td>
                    <td className="hidden px-4 py-3 font-mono-tnum text-xs sm:table-cell">{formatCurrency(p.avgPrice)}</td>
                    <td className="hidden px-4 py-3 font-mono-tnum text-xs md:table-cell">{formatCurrency(p.currentPrice)}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{p.connectionName}</td>
                    <td className="px-4 py-3 font-mono-tnum text-xs">{formatCurrency(p.marketValue)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'font-mono-tnum text-xs font-medium',
                          p.pnl >= 0 ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {p.pnl >= 0 ? '+' : '−'}{formatCurrency(Math.abs(p.pnl))}
                      </span>
                      <p className={cn('text-[11px]', p.pnl >= 0 ? 'text-success' : 'text-destructive')}>
                        {formatPercent(p.pnlPercent)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingClose(p)}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Clôturer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {positions.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune position ouverte.
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingClose !== null} onOpenChange={(o) => !o && setPendingClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer la position ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingClose &&
                `${pendingClose.qty} ${pendingClose.ticker} (${pendingClose.side}) sur ${pendingClose.connectionName} seront liquidés au prix de marché.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
