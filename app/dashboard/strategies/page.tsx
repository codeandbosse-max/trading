'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Radio,
  Plus,
  Copy,
  Power,
  RefreshCw,
  Trash2,
  Pencil,
  Webhook,
  Shield,
  ListChecks,
  Ban,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import { StrategyDialog } from '@/components/dashboard/strategy-dialog';
import { SubscriptionDialog } from '@/components/dashboard/subscription-dialog';
import { useStore } from '@/lib/store';
import { type Strategy, type StrategyStatus, type Subscription } from '@/lib/mock-data';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const statusConfig: Record<StrategyStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  brouillon: { label: 'Brouillon', variant: 'outline' },
  suspendue: { label: 'Suspendue', variant: 'secondary' },
  archivee: { label: 'Archivée', variant: 'destructive' },
};

const assetClassLabel: Record<string, string> = {
  actions: 'Actions',
  etf: 'ETF',
  options: 'Options',
  futures: 'Futures',
  crypto: 'Crypto',
  forex: 'Forex',
};

const sizingLabel: Record<string, string> = {
  quantite_fixe: 'Quantité fixe',
  pourcentage_capital: '% du capital',
  montant_monetaire: 'Montant $',
  risque_par_trade: 'Risque par trade',
  taille_du_signal: 'Taille du signal',
};

const execModeLabel: Record<string, string> = {
  automatique: 'Automatique',
  validation_manuelle: 'Validation manuelle',
  simulation: 'Simulation',
};

export default function StrategiesPage() {
  const {
    state,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    regenerateSecret,
    deleteSubscription,
  } = useStore();
  const { strategies, subscriptions, connections } = state;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Strategy | undefined>(undefined);
  const [subOpen, setSubOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Strategy | null>(null);

  const selected = strategies.find((s) => s.id === selectedId) ?? null;
  const strategySubs = selected
    ? subscriptions.filter((s) => s.strategyId === selected.id)
    : [];

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (strategy: Strategy) => {
    setEditing(strategy);
    setFormOpen(true);
  };

  const duplicate = (strategy: Strategy) => {
    const copy = createStrategy({
      name: `${strategy.name} (copie)`,
      description: strategy.description,
      status: 'brouillon',
      assetClass: strategy.assetClass,
      allowedActions: strategy.allowedActions,
      whitelist: strategy.whitelist,
      blacklist: strategy.blacklist,
      maxSignalDelaySec: strategy.maxSignalDelaySec,
      rejectDuplicates: strategy.rejectDuplicates,
      maxVolume: strategy.maxVolume,
      maxExposure: strategy.maxExposure,
      defaultOrderType: strategy.defaultOrderType,
    });
    toast.success('Stratégie dupliquée', { description: copy.name });
    setSelectedId(copy.id);
  };

  const toggleStatus = (strategy: Strategy) => {
    const next: StrategyStatus = strategy.status === 'active' ? 'suspendue' : 'active';
    updateStrategy({ ...strategy, status: next });
    toast.success(next === 'active' ? 'Stratégie activée' : 'Stratégie suspendue');
  };

  const rotateSecret = (strategy: Strategy) => {
    regenerateSecret(strategy.id);
    toast.success('Secret régénéré', {
      description: 'Mettez à jour vos alertes TradingView avec le nouveau secret.',
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteStrategy(pendingDelete.id);
    toast.success('Stratégie supprimée', { description: pendingDelete.name });
    if (selectedId === pendingDelete.id) setSelectedId(null);
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stratégies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Définissez les règles appliquées aux signaux entrants et associez-les à vos comptes.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Créer une stratégie
        </Button>
      </div>

      {/* Strategy cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {strategies.map((s) => {
          const st = statusConfig[s.status];
          return (
            <Card
              key={s.id}
              className="group cursor-pointer transition-all hover:border-accent/40 hover:shadow-md"
              onClick={() => setSelectedId(s.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        s.status === 'active' ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Radio className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold leading-tight">{s.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {assetClassLabel[s.assetClass]} · {s.subscriptionsCount} souscription(s)
                      </p>
                    </div>
                  </div>
                  <Badge variant={st.variant} className="text-[10px]">
                    {st.label}
                  </Badge>
                </div>

                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{s.description}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.whitelist.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {t}
                    </span>
                  ))}
                  {s.whitelist.length > 4 && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      +{s.whitelist.length - 4}
                    </span>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      {s.signalsToday} signaux aujourd’hui
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Webhook className="h-3.5 w-3.5" />
                      {s.webhookId}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="overflow-y-auto scrollbar-thin sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <SheetTitle>{selected.name}</SheetTitle>
                    <SheetDescription>
                      Créée le {formatDateTime(selected.createdAt)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6 p-6">
                {/* Description */}
                <p className="text-sm text-muted-foreground">{selected.description}</p>

                {/* Status + actions */}
                <div className="flex items-center gap-2">
                  <Badge variant={statusConfig[selected.status].variant} className="text-xs">
                    {statusConfig[selected.status].label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {assetClassLabel[selected.assetClass]}
                  </Badge>
                </div>

                {/* Webhook info */}
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Webhook className="h-4 w-4 text-accent" />
                    URL de webhook
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Identifiant</p>
                      <p className="font-mono text-xs">{selected.webhookId}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Secret</p>
                      <p className="break-all font-mono text-xs">{selected.webhookSecret}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          `${window.location.origin}/api/webhook/${selected.webhookId}`
                        );
                        toast.success('URL copiée');
                      }}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copier l’URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => rotateSecret(selected)}
                    >
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Régénérer
                    </Button>
                  </div>
                </div>

                {/* Allowed actions */}
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-medium">
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                    Actions autorisées
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.allowedActions.map((a) => (
                      <Badge key={a} variant="secondary" className="text-[10px] uppercase">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Whitelist / blacklist */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="h-4 w-4 text-success" />
                      Liste blanche
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.whitelist.length > 0 ? (
                        selected.whitelist.map((t) => (
                          <span key={t} className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Tous autorisés</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-medium">
                      <Ban className="h-4 w-4 text-destructive" />
                      Liste noire
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.blacklist.length > 0 ? (
                        selected.blacklist.map((t) => (
                          <span key={t} className="rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Aucune</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Security params */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Paramètres de sécurité
                  </h4>
                  <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Délai max du signal</span>
                      <span className="font-medium">{selected.maxSignalDelaySec}s</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Refus des doublons</span>
                      <span className="font-medium">{selected.rejectDuplicates ? 'Oui' : 'Non'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Volume maximal</span>
                      <span className="font-medium">{selected.maxVolume}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exposition maximale</span>
                      <span className="font-medium">{selected.maxExposure.toLocaleString('fr-FR')} $</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type d’ordre par défaut</span>
                      <span className="font-medium capitalize">{selected.defaultOrderType}</span>
                    </div>
                  </div>
                </div>

                {/* Subscriptions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-medium">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      Souscriptions ({strategySubs.length})
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSub(undefined);
                        setSubOpen(true);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Associer
                    </Button>
                  </div>
                  {strategySubs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune souscription. Associez un compte pour activer le routage.</p>
                  ) : (
                    <div className="space-y-2">
                      {strategySubs.map((sub) => {
                        const conn = connections.find((c) => c.id === sub.connectionId);
                        return (
                          <div key={sub.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{conn?.name ?? '—'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {execModeLabel[sub.executionMode]} · {sizingLabel[sub.sizingMethod]}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Badge
                                  variant={sub.enabled ? 'default' : 'outline'}
                                  className={cn('text-[10px]', sub.enabled && 'bg-success text-success-foreground')}
                                >
                                  {sub.enabled ? 'Active' : 'Inactive'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setEditingSub(sub);
                                    setSubOpen(true);
                                  }}
                                  aria-label="Modifier la souscription"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    deleteSubscription(sub.id);
                                    toast.success('Souscription supprimée');
                                  }}
                                  aria-label="Supprimer la souscription"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Modifier
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => duplicate(selected)}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Dupliquer
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(selected)}>
                    <Power className="mr-2 h-3.5 w-3.5" />
                    {selected.status === 'active' ? 'Suspendre' : 'Activer'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(selected)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <StrategyDialog strategy={editing} open={formOpen} onOpenChange={setFormOpen} />
      <SubscriptionDialog
        subscription={editingSub}
        strategyId={selectedId ?? undefined}
        open={subOpen}
        onOpenChange={setSubOpen}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette stratégie ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} et ses souscriptions seront supprimées. Le webhook associé
              cessera immédiatement d’accepter des signaux.
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
