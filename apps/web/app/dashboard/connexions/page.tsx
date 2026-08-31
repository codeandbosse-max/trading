'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Plug,
  Plus,
  Power,
  Trash2,
  Activity,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Wallet,
  TrendingUp,
  Pencil,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
import { ConnectionDialog } from '@/components/dashboard/connection-dialog';
import { useStore } from '@/lib/store';
import { type Connection, type ConnectionStatus, type ConnectionEnv } from '@/lib/mock-data';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const statusConfig: Record<ConnectionStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  actif: { label: 'Actif', color: 'text-success', bg: 'bg-success/10', icon: ShieldCheck },
  expire: { label: 'Expiré', color: 'text-warning', bg: 'bg-warning/10', icon: AlertTriangle },
  erreur: { label: 'Erreur d’auth.', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
  indisponible: { label: 'Indisponible', color: 'text-muted-foreground', bg: 'bg-muted', icon: XCircle },
};

const envConfig: Record<ConnectionEnv, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  simulation: { label: 'Simulation', variant: 'outline' },
  demonstration: { label: 'Démonstration', variant: 'secondary' },
  reel: { label: 'Réel', variant: 'destructive' },
};

export default function ConnectionsPage() {
  const { state, testConnection, setConnectionEnabled, deleteConnection } = useStore();
  const connections = state.connections;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Connection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (connection: Connection) => {
    setEditing(connection);
    setDialogOpen(true);
  };

  const runTest = async (id: string) => {
    setTestingId(id);
    await testConnection(id);
    setTestingId(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteConnection(pendingDelete.id);
    toast.success('Connexion supprimée', { description: pendingDelete.name });
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connexions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos connexions vers courtiers, exchanges et prop firms.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une connexion
        </Button>
      </div>

      {/* Connection cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {connections.map((c) => {
          const st = statusConfig[c.status];
          const env = envConfig[c.env];
          const StatusIcon = st.icon;
          return (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        st.bg
                      )}
                    >
                      <Plug className={cn('h-5 w-5', st.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {c.broker} · {c.currency}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={env.variant} className="text-[10px]">
                      {env.label}
                    </Badge>
                    <Switch
                      checked={c.status === 'actif'}
                      onCheckedChange={(v) => setConnectionEnabled(c.id, v)}
                      aria-label={`Activer ${c.name}`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status bar */}
                <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', st.bg)}>
                  <StatusIcon className={cn('h-4 w-4', st.color)} />
                  <span className={cn('text-sm font-medium', st.color)}>{st.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Testé {formatDateTime(c.lastTestAt)}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      <span className="text-[11px] uppercase">Capital</span>
                    </div>
                    <p className="mt-1 font-mono-tnum text-sm font-semibold">
                      {formatCurrency(c.equity, c.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-[11px] uppercase">Pouvoir d’achat</span>
                    </div>
                    <p className="mt-1 font-mono-tnum text-sm font-semibold">
                      {formatCurrency(c.buyingPower, c.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      <span className="text-[11px] uppercase">Positions</span>
                    </div>
                    <p className="mt-1 font-mono-tnum text-sm font-semibold">{c.positionsCount}</p>
                  </div>
                </div>

                {/* Instruments */}
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Instruments autorisés
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.allowedInstruments.map((i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] capitalize">
                        {i}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => runTest(c.id)}
                    disabled={testingId === c.id}
                  >
                    {testingId === c.id ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="mr-2 h-3.5 w-3.5" />
                    )}
                    {testingId === c.id ? 'Test en cours…' : 'Tester'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setConnectionEnabled(c.id, c.status !== 'actif')}
                  >
                    <Power className="mr-2 h-3.5 w-3.5" />
                    {c.status === 'actif' ? 'Désactiver' : 'Activer'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => openEdit(c)}
                    aria-label={`Modifier ${c.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(c)}
                    aria-label={`Supprimer ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Adapter note */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Couche d’adaptateurs broker</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Chaque connexion est isolée derrière une interface commune. De nouveaux courtiers peuvent être ajoutés sans modifier le moteur métier central. Les clés API et tokens sont stockés chiffrés au repos.
            </p>
          </div>
        </CardContent>
      </Card>

      <ConnectionDialog
        connection={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette connexion ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} sera retirée, ainsi que tous les abonnements qui l’utilisent.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
