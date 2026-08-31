'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { executionModes, sizingMethods, type Subscription } from '@trading/shared';
import {
  subscriptionFormSchema,
  type SubscriptionFormValues,
  type SubscriptionFormOutput,
} from '@/lib/forms';

const modeLabels: Record<string, string> = {
  automatique: 'Automatique',
  validation_manuelle: 'Validation manuelle',
  simulation: 'Simulation',
};

const sizingLabels: Record<string, string> = {
  quantite_fixe: 'Quantité fixe',
  pourcentage_capital: '% du capital',
  montant_monetaire: 'Montant monétaire',
  risque_par_trade: 'Risque par trade (%)',
  taille_du_signal: 'Taille du signal',
};

function defaults(
  subscription?: Subscription,
  strategyId?: string
): SubscriptionFormValues {
  return {
    strategyId: subscription?.strategyId ?? strategyId ?? '',
    connectionId: subscription?.connectionId ?? '',
    enabled: subscription?.enabled ?? true,
    executionMode: subscription?.executionMode ?? 'automatique',
    sizingMethod: subscription?.sizingMethod ?? 'quantite_fixe',
    sizingValue: subscription?.sizingValue ?? 10,
    maxOrderSize: subscription?.maxOrderSize ?? 100,
    maxExposure: subscription?.maxExposure ?? 25000,
    allowShort: subscription?.allowShort ?? false,
    tickerOverride: subscription?.tickerOverride ?? '',
  };
}

export function SubscriptionDialog({
  subscription,
  strategyId,
  open,
  onOpenChange,
}: {
  subscription?: Subscription;
  strategyId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, createSubscription, updateSubscription } = useStore();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionFormValues, unknown, SubscriptionFormOutput>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: defaults(subscription, strategyId),
  });

  useEffect(() => {
    if (open) reset(defaults(subscription, strategyId));
  }, [open, subscription, strategyId, reset]);

  const values = watch();

  const onSubmit = async (data: SubscriptionFormOutput) => {
    const payload = {
      ...data,
      tickerOverride: data.tickerOverride && data.tickerOverride.length > 0 ? data.tickerOverride : null,
    };
    try {
      if (subscription) {
        await updateSubscription(subscription.id, payload);
        toast.success('Abonnement mis à jour');
      } else {
        await createSubscription(payload);
        toast.success('Abonnement créé');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Enregistrement impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{subscription ? 'Modifier l’abonnement' : 'Nouvel abonnement'}</DialogTitle>
          <DialogDescription>
            Relie une stratégie à un compte de courtage et définit le dimensionnement des ordres.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Stratégie</Label>
              <Select
                value={values.strategyId}
                onValueChange={(v) => setValue('strategyId', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {state.strategies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.strategyId && (
                <p className="text-xs text-destructive">{errors.strategyId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Connexion</Label>
              <Select
                value={values.connectionId}
                onValueChange={(v) => setValue('connectionId', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {state.connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.connectionId && (
                <p className="text-xs text-destructive">{errors.connectionId.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode d’exécution</Label>
              <Select
                value={values.executionMode}
                onValueChange={(v) =>
                  setValue('executionMode', v as SubscriptionFormValues['executionMode'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {executionModes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {modeLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Méthode de dimensionnement</Label>
              <Select
                value={values.sizingMethod}
                onValueChange={(v) =>
                  setValue('sizingMethod', v as SubscriptionFormValues['sizingMethod'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizingMethods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {sizingLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sizingValue">Valeur</Label>
              <Input id="sizingValue" type="number" step="any" {...register('sizingValue')} />
              {errors.sizingValue && (
                <p className="text-xs text-destructive">{errors.sizingValue.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxOrderSize">Taille max. d’ordre</Label>
              <Input id="maxOrderSize" type="number" step="any" {...register('maxOrderSize')} />
              {errors.maxOrderSize && (
                <p className="text-xs text-destructive">{errors.maxOrderSize.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subMaxExposure">Exposition max.</Label>
              <Input id="subMaxExposure" type="number" step="any" {...register('maxExposure')} />
              {errors.maxExposure && (
                <p className="text-xs text-destructive">{errors.maxExposure.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tickerOverride">Remplacement de ticker (optionnel)</Label>
            <Input id="tickerOverride" {...register('tickerOverride')} placeholder="BTCUSDT" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm font-medium">Abonnement actif</span>
              <Switch
                checked={values.enabled}
                onCheckedChange={(v) => setValue('enabled', v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm font-medium">Autoriser la vente à découvert</span>
              <Switch
                checked={values.allowShort}
                onCheckedChange={(v) => setValue('allowShort', v)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {subscription ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
