import { z } from 'zod';
import {
  assetClasses,
  connectionEnvs,
  connectionStatuses,
  executionModes,
  orderTypes,
  signalActions,
  sizingMethods,
  strategyStatuses,
} from '@trading/shared';

/** Form fields hold comma-separated text; `splitTickers` converts them for the API. */
const tickerField = z.string().trim().max(500);

export function splitTickers(value: string): string[] {
  return value.length === 0 ? [] : value.split(',').map((t) => t.trim()).filter(Boolean);
}

export const strategyFormSchema = z.object({
  name: z.string().trim().min(3, 'Le nom doit contenir au moins 3 caractères.').max(60),
  description: z.string().trim().min(10, 'Décrivez la stratégie en 10 caractères minimum.').max(300),
  status: z.enum(strategyStatuses),
  assetClass: z.enum(assetClasses),
  allowedActions: z.array(z.enum(signalActions)).min(1, 'Sélectionnez au moins une action.'),
  whitelist: tickerField,
  blacklist: tickerField,
  maxSignalDelaySec: z.coerce.number().int().min(1).max(3600),
  rejectDuplicates: z.boolean(),
  maxVolume: z.coerce.number().positive('Le volume doit être positif.'),
  maxExposure: z.coerce.number().positive('L’exposition doit être positive.'),
  defaultOrderType: z.enum(orderTypes),
});

export type StrategyFormValues = z.input<typeof strategyFormSchema>;
export type StrategyFormOutput = z.output<typeof strategyFormSchema>;

export const connectionFormSchema = z.object({
  name: z.string().trim().min(3, 'Le nom doit contenir au moins 3 caractères.').max(60),
  broker: z.string().trim().min(2, 'Indiquez le courtier.'),
  env: z.enum(connectionEnvs),
  status: z.enum(connectionStatuses),
  currency: z.string().trim().length(3, 'Code devise sur 3 lettres (ex. USD).').toUpperCase(),
  apiKey: z.string().trim().min(8, 'Clé API trop courte.'),
  apiSecret: z.string().trim().min(8, 'Secret API trop court.'),
  buyingPower: z.coerce.number().min(0),
  equity: z.coerce.number().min(0),
  allowedInstruments: tickerField,
});

export type ConnectionFormValues = z.input<typeof connectionFormSchema>;
export type ConnectionFormOutput = z.output<typeof connectionFormSchema>;

export const subscriptionFormSchema = z
  .object({
    strategyId: z.string().min(1, 'Sélectionnez une stratégie.'),
    connectionId: z.string().min(1, 'Sélectionnez une connexion.'),
    enabled: z.boolean(),
    executionMode: z.enum(executionModes),
    sizingMethod: z.enum(sizingMethods),
    sizingValue: z.coerce.number().positive('La valeur de dimensionnement doit être positive.'),
    maxOrderSize: z.coerce.number().positive('La taille maximale doit être positive.'),
    maxExposure: z.coerce.number().positive('L’exposition maximale doit être positive.'),
    allowShort: z.boolean(),
    tickerOverride: z.string().trim().max(20).optional(),
  })
  .refine((v) => v.sizingMethod !== 'quantite_fixe' || v.sizingValue <= v.maxOrderSize, {
    message: 'La quantité fixe dépasse la taille maximale d’ordre.',
    path: ['sizingValue'],
  });

export type SubscriptionFormValues = z.input<typeof subscriptionFormSchema>;
export type SubscriptionFormOutput = z.output<typeof subscriptionFormSchema>;
