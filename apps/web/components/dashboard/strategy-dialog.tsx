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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import {
  signalActions,
  assetClasses,
  strategyStatuses,
  orderTypes,
  type Strategy,
  type SignalAction,
} from '@trading/shared';
import {
  strategyFormSchema,
  splitTickers,
  type StrategyFormValues,
  type StrategyFormOutput,
} from '@/lib/forms';

const actionLabels: Record<SignalAction, string> = {
  buy: 'Achat',
  sell: 'Vente',
  short: 'Vente à découvert',
  cover: 'Rachat',
  exit: 'Sortie',
  reverse: 'Inversion',
};

const assetLabels: Record<string, string> = {
  actions: 'Actions',
  etf: 'ETF',
  options: 'Options',
  futures: 'Futures',
  crypto: 'Crypto',
  forex: 'Forex',
};

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  active: 'Active',
  suspendue: 'Suspendue',
  archivee: 'Archivée',
};

function defaults(strategy?: Strategy): StrategyFormValues {
  return {
    name: strategy?.name ?? '',
    description: strategy?.description ?? '',
    status: strategy?.status ?? 'brouillon',
    assetClass: strategy?.assetClass ?? 'actions',
    allowedActions: strategy?.allowedActions ?? ['buy', 'sell'],
    whitelist: strategy?.whitelist.join(', ') ?? '',
    blacklist: strategy?.blacklist.join(', ') ?? '',
    maxSignalDelaySec: strategy?.maxSignalDelaySec ?? 30,
    rejectDuplicates: strategy?.rejectDuplicates ?? true,
    maxVolume: strategy?.maxVolume ?? 100,
    maxExposure: strategy?.maxExposure ?? 50000,
    defaultOrderType: (strategy?.defaultOrderType as StrategyFormValues['defaultOrderType']) ?? 'market',
  };
}

export function StrategyDialog({
  strategy,
  open,
  onOpenChange,
}: {
  strategy?: Strategy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createStrategy, updateStrategy } = useStore();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StrategyFormValues, unknown, StrategyFormOutput>({
    resolver: zodResolver(strategyFormSchema),
    defaultValues: defaults(strategy),
  });

  useEffect(() => {
    if (open) reset(defaults(strategy));
  }, [open, strategy, reset]);

  const selectedActions = (watch('allowedActions') ?? []) as SignalAction[];
  const status = watch('status');
  const assetClass = watch('assetClass');
  const defaultOrderType = watch('defaultOrderType');
  const rejectDuplicates = watch('rejectDuplicates');

  const toggleAction = (action: SignalAction) => {
    const next = selectedActions.includes(action)
      ? selectedActions.filter((a) => a !== action)
      : [...selectedActions, action];
    setValue('allowedActions', next, { shouldValidate: true });
  };

  const onSubmit = async (values: StrategyFormOutput) => {
    const payload = {
      ...values,
      whitelist: splitTickers(values.whitelist),
      blacklist: splitTickers(values.blacklist),
    };
    try {
      if (strategy) {
        await updateStrategy(strategy.id, payload);
        toast.success('Stratégie mise à jour', { description: values.name });
      } else {
        await createStrategy(payload);
        toast.success('Stratégie créée', { description: 'Webhook et secret générés.' });
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{strategy ? 'Modifier la stratégie' : 'Nouvelle stratégie'}</DialogTitle>
          <DialogDescription>
            Définissez le périmètre d’exécution et les garde-fous appliqués aux signaux entrants.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" {...register('name')} placeholder="MACD Swing" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register('description')} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue('status', v as StrategyFormValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strategyStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Classe d’actifs</Label>
              <Select
                value={assetClass}
                onValueChange={(v) => setValue('assetClass', v as StrategyFormValues['assetClass'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assetClasses.map((a) => (
                    <SelectItem key={a} value={a}>
                      {assetLabels[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type d’ordre par défaut</Label>
              <Select
                value={defaultOrderType}
                onValueChange={(v) =>
                  setValue('defaultOrderType', v as StrategyFormValues['defaultOrderType'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderTypes.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Actions autorisées</Label>
            <div className="flex flex-wrap gap-2">
              {signalActions.map((action) => {
                const active = selectedActions.includes(action);
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleAction(action)}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                  >
                    <Badge
                      variant={active ? 'default' : 'outline'}
                      className={cn('cursor-pointer', !active && 'text-muted-foreground')}
                    >
                      {actionLabels[action]}
                    </Badge>
                  </button>
                );
              })}
            </div>
            {errors.allowedActions && (
              <p className="text-xs text-destructive">{errors.allowedActions.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whitelist">Liste blanche (séparée par des virgules)</Label>
              <Input id="whitelist" {...register('whitelist')} placeholder="AAPL, MSFT, NVDA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blacklist">Liste noire</Label>
              <Input id="blacklist" {...register('blacklist')} placeholder="PENNY, OTC" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="maxSignalDelaySec">Délai max. du signal (s)</Label>
              <Input id="maxSignalDelaySec" type="number" {...register('maxSignalDelaySec')} />
              {errors.maxSignalDelaySec && (
                <p className="text-xs text-destructive">{errors.maxSignalDelaySec.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxVolume">Volume max.</Label>
              <Input id="maxVolume" type="number" step="any" {...register('maxVolume')} />
              {errors.maxVolume && (
                <p className="text-xs text-destructive">{errors.maxVolume.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxExposure">Exposition max.</Label>
              <Input id="maxExposure" type="number" step="any" {...register('maxExposure')} />
              {errors.maxExposure && (
                <p className="text-xs text-destructive">{errors.maxExposure.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Rejeter les doublons</p>
              <p className="text-xs text-muted-foreground">
                Ignore un signal déjà reçu avec le même identifiant.
              </p>
            </div>
            <Switch
              checked={rejectDuplicates}
              onCheckedChange={(v) => setValue('rejectDuplicates', v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {strategy ? 'Enregistrer' : 'Créer la stratégie'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
