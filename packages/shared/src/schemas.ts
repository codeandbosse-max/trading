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
export const orderStatuses = [
  'recu',
  'valide',
  'en_attente_validation',
  'envoi_en_cours',
  'soumis',
  'execute_partiellement',
  'execute',
  'annule',
  'rejete',
  'erreur',
] as const;

/** API contract: ticker lists are always arrays. */
const tickerList = z.array(z.string().trim().min(1).max(20)).max(500);

export const strategyInputSchema = z.object({
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

export type StrategyInput = z.input<typeof strategyInputSchema>;
export type StrategyPayload = z.output<typeof strategyInputSchema>;

export const connectionInputSchema = z.object({
  name: z.string().trim().min(3, 'Le nom doit contenir au moins 3 caractères.').max(60),
  broker: z.string().trim().min(2, 'Indiquez le courtier.'),
  env: z.enum(connectionEnvs),
  status: z.enum(connectionStatuses),
  currency: z.string().trim().length(3, 'Code devise sur 3 lettres (ex. USD).').toUpperCase(),
  buyingPower: z.coerce.number().min(0),
  equity: z.coerce.number().min(0),
  allowedInstruments: tickerList,
});

export type ConnectionInput = z.input<typeof connectionInputSchema>;
export type ConnectionPayload = z.output<typeof connectionInputSchema>;

/** Credentials are accepted by the API but never returned to clients. */
export const connectionFormSchema = connectionInputSchema.extend({
  apiKey: z.string().trim().min(8, 'Clé API trop courte.'),
  apiSecret: z.string().trim().min(8, 'Secret API trop court.'),
});

export type ConnectionFormValues = z.input<typeof connectionFormSchema>;
export type ConnectionFormOutput = z.output<typeof connectionFormSchema>;

export const subscriptionInputSchema = z
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
    tickerOverride: z.string().trim().max(20).nullable().optional(),
  })
  .refine((v) => v.sizingMethod !== 'quantite_fixe' || v.sizingValue <= v.maxOrderSize, {
    message: 'La quantité fixe dépasse la taille maximale d’ordre.',
    path: ['sizingValue'],
  });

export type SubscriptionInput = z.input<typeof subscriptionInputSchema>;
export type SubscriptionPayload = z.output<typeof subscriptionInputSchema>;

export const riskRuleUpdateSchema = z.object({
  value: z.string().trim().min(1, 'Valeur requise.').max(60),
  enabled: z.boolean(),
});

export const killSwitchSchema = z.object({ active: z.boolean() });

export const orderActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'retry']),
  reason: z.string().trim().max(200).optional(),
});

export const userRoles = ['admin', 'operateur', 'lecture'] as const;

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(160),
  name: z.string().trim().min(2, 'Indiquez un nom d’au moins 2 caractères.').max(80),
  password: z
    .string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères.')
    .max(200)
    .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
      message: 'Utilisez au moins une minuscule, une majuscule et un chiffre.',
    }),
  signupCode: z.string().trim().max(200).optional(),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterPayload = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(160),
  password: z.string().min(1, 'Mot de passe requis.').max(200),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginPayload = z.output<typeof loginSchema>;

/** Payload accepted by the public webhook ingestion endpoint. */
export const webhookPayloadSchema = z.object({
  signalId: z.string().trim().min(1).max(100).optional(),
  ticker: z.string().trim().min(1).max(20),
  action: z.enum(signalActions),
  quantity: z.number().positive().max(1_000_000).optional(),
  price: z.number().positive().max(10_000_000).optional(),
  stopLoss: z.number().positive().max(10_000_000).optional(),
  orderType: z.enum(orderTypes).optional(),
  source: z.string().trim().max(60).optional(),
  timestamp: z.string().trim().max(40).optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
