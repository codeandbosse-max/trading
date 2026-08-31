import { z } from 'zod';

export const signalActions = ['buy', 'sell', 'short', 'cover', 'exit', 'reverse'] as const;
export const assetClasses = ['actions', 'etf', 'options', 'futures', 'crypto', 'forex'] as const;
export const strategyStatuses = ['brouillon', 'active', 'suspendue', 'archivee'] as const;
export const connectionEnvs = ['simulation', 'demonstration', 'reel'] as const;
export const connectionStatuses = ['actif', 'expire', 'erreur', 'indisponible'] as const;
export const executionModes = ['automatique', 'validation_manuelle', 'simulation'] as const;
export const sizingMethods = [
  'quantite_fixe',
  'pourcentage_capital',
  'montant_monetaire',
  'risque_par_trade',
  'taille_du_signal',
] as const;
export const orderTypes = ['market', 'limit', 'stop', 'stop_limit'] as const;

const tickerList = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? [] : v.split(',').map((t) => t.trim()).filter(Boolean)));

export const strategySchema = z.object({
  name: z.string().trim().min(3, 'Le nom doit contenir au moins 3 caractères.').max(60),
  description: z.string().trim().min(10, 'Décrivez la stratégie en 10 caractères minimum.').max(300),
  status: z.enum(strategyStatuses),
  assetClass: z.enum(assetClasses),
  allowedActions: z.array(z.enum(signalActions)).min(1, 'Sélectionnez au moins une action.'),
  whitelist: tickerList,
  blacklist: tickerList,
  maxSignalDelaySec: z.coerce.number().int().min(1).max(3600),
  rejectDuplicates: z.boolean(),
  maxVolume: z.coerce.number().positive('Le volume doit être positif.'),
  maxExposure: z.coerce.number().positive('L’exposition doit être positive.'),
  defaultOrderType: z.enum(orderTypes),
});

export type StrategyFormValues = z.input<typeof strategySchema>;
export type StrategyFormOutput = z.output<typeof strategySchema>;

export const connectionSchema = z.object({
  name: z.string().trim().min(3, 'Le nom doit contenir au moins 3 caractères.').max(60),
  broker: z.string().trim().min(2, 'Indiquez le courtier.'),
  env: z.enum(connectionEnvs),
  status: z.enum(connectionStatuses),
  currency: z.string().trim().length(3, 'Code devise sur 3 lettres (ex. USD).').toUpperCase(),
  apiKey: z.string().trim().min(8, 'Clé API trop courte.'),
  apiSecret: z.string().trim().min(8, 'Secret API trop court.'),
  buyingPower: z.coerce.number().min(0),
  equity: z.coerce.number().min(0),
  allowedInstruments: tickerList,
});

export type ConnectionFormValues = z.input<typeof connectionSchema>;
export type ConnectionFormOutput = z.output<typeof connectionSchema>;

export const subscriptionSchema = z
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
  .refine((v) => v.sizingValue <= v.maxOrderSize || v.sizingMethod !== 'quantite_fixe', {
    message: 'La quantité fixe dépasse la taille maximale d’ordre.',
    path: ['sizingValue'],
  });

export type SubscriptionFormValues = z.input<typeof subscriptionSchema>;
export type SubscriptionFormOutput = z.output<typeof subscriptionSchema>;

export const riskRuleSchema = z.object({
  value: z.string().trim().min(1, 'Valeur requise.'),
  enabled: z.boolean(),
});

/** Payload accepted by the public webhook ingestion endpoint. */
export const webhookPayloadSchema = z.object({
  signalId: z.string().trim().min(1).max(100).optional(),
  ticker: z.string().trim().min(1).max(20),
  action: z.enum(signalActions),
  quantity: z.number().positive().max(1_000_000).optional(),
  price: z.number().positive().max(10_000_000).optional(),
  orderType: z.enum(orderTypes).optional(),
  source: z.string().trim().max(60).optional(),
  timestamp: z.string().trim().max(40).optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
