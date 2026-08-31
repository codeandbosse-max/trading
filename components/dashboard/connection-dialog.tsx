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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStore } from '@/lib/store';
import type { Connection } from '@/lib/mock-data';
import { connectionSchema, connectionEnvs, type ConnectionFormValues, type ConnectionFormOutput } from '@/lib/schemas';

const brokers = ['Alpaca', 'Interactive Brokers', 'Binance', 'Tradier', 'Coinbase'];

const envLabels: Record<string, string> = {
  simulation: 'Simulation (paper)',
  demonstration: 'Démonstration',
  reel: 'Réel',
};

function defaults(connection?: Connection): ConnectionFormValues {
  return {
    name: connection?.name ?? '',
    broker: connection?.broker ?? 'Alpaca',
    env: connection?.env ?? 'simulation',
    status: connection?.status ?? 'actif',
    currency: connection?.currency ?? 'USD',
    apiKey: '',
    apiSecret: '',
    buyingPower: connection?.buyingPower ?? 100000,
    equity: connection?.equity ?? 100000,
    allowedInstruments: connection?.allowedInstruments.join(', ') ?? '',
  };
}

export function ConnectionDialog({
  connection,
  open,
  onOpenChange,
}: {
  connection?: Connection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createConnection, updateConnection } = useStore();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ConnectionFormValues, unknown, ConnectionFormOutput>({
    resolver: zodResolver(connectionSchema),
    defaultValues: defaults(connection),
  });

  useEffect(() => {
    if (open) reset(defaults(connection));
  }, [open, connection, reset]);

  const broker = watch('broker');
  const env = watch('env');

  const onSubmit = (values: ConnectionFormOutput) => {
    // API credentials are never persisted client-side; only the connection metadata is stored.
    const { apiKey: _apiKey, apiSecret: _apiSecret, ...meta } = values;
    if (connection) {
      updateConnection({ ...connection, ...meta });
      toast.success('Connexion mise à jour', { description: meta.name });
    } else {
      createConnection(meta);
      toast.success('Connexion ajoutée', { description: `${meta.broker} — ${envLabels[meta.env]}` });
    }
    reset(defaults());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{connection ? 'Modifier la connexion' : 'Ajouter une connexion'}</DialogTitle>
          <DialogDescription>
            Les identifiants sont utilisés pour tester la connexion et ne sont pas conservés dans le
            navigateur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="conn-name">Nom</Label>
            <Input id="conn-name" {...register('name')} placeholder="Alpaca Paper Principal" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Courtier</Label>
              <Select value={broker} onValueChange={(v) => setValue('broker', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Environnement</Label>
              <Select
                value={env}
                onValueChange={(v) => setValue('env', v as ConnectionFormValues['env'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectionEnvs.map((e) => (
                    <SelectItem key={e} value={e}>
                      {envLabels[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Clé API</Label>
              <Input id="apiKey" autoComplete="off" {...register('apiKey')} />
              {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">Secret API</Label>
              <Input id="apiSecret" type="password" autoComplete="new-password" {...register('apiSecret')} />
              {errors.apiSecret && (
                <p className="text-xs text-destructive">{errors.apiSecret.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <Input id="currency" maxLength={3} {...register('currency')} />
              {errors.currency && (
                <p className="text-xs text-destructive">{errors.currency.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="equity">Capital</Label>
              <Input id="equity" type="number" step="any" {...register('equity')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyingPower">Pouvoir d’achat</Label>
              <Input id="buyingPower" type="number" step="any" {...register('buyingPower')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedInstruments">Instruments autorisés</Label>
            <Input
              id="allowedInstruments"
              {...register('allowedInstruments')}
              placeholder="Actions, ETF, Options"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {connection ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
