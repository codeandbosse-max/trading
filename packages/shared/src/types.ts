export type StrategyStatus = 'brouillon' | 'active' | 'suspendue' | 'archivee';
export type AssetClass = 'actions' | 'etf' | 'options' | 'futures' | 'crypto' | 'forex';
export type ConnectionStatus = 'actif' | 'expire' | 'erreur' | 'indisponible';
export type ConnectionEnv = 'simulation' | 'demonstration' | 'reel';
export type OrderStatus =
  | 'recu'
  | 'valide'
  | 'en_attente_validation'
  | 'envoi_en_cours'
  | 'soumis'
  | 'execute_partiellement'
  | 'execute'
  | 'annule'
  | 'rejete'
  | 'erreur';
export type SignalAction = 'buy' | 'sell' | 'short' | 'cover' | 'exit' | 'reverse';
export type ExecutionMode = 'automatique' | 'validation_manuelle' | 'simulation';
export type SizingMethod =
  | 'quantite_fixe'
  | 'pourcentage_capital'
  | 'montant_monetaire'
  | 'risque_par_trade'
  | 'taille_du_signal';
export type SignalStatus = 'accepte' | 'rejete' | 'duplique' | 'expire';
export type Severity = 'info' | 'warning' | 'critical';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  status: StrategyStatus;
  assetClass: AssetClass;
  allowedActions: SignalAction[];
  whitelist: string[];
  blacklist: string[];
  webhookId: string;
  webhookSecret: string;
  maxSignalDelaySec: number;
  rejectDuplicates: boolean;
  maxVolume: number;
  maxExposure: number;
  defaultOrderType: string;
  subscriptionsCount: number;
  signalsToday: number;
  createdAt: string;
}

export interface Connection {
  id: string;
  name: string;
  broker: string;
  env: ConnectionEnv;
  status: ConnectionStatus;
  currency: string;
  buyingPower: number;
  equity: number;
  positionsCount: number;
  lastTestAt: string;
  allowedInstruments: string[];
}

export interface Subscription {
  id: string;
  strategyId: string;
  connectionId: string;
  enabled: boolean;
  executionMode: ExecutionMode;
  sizingMethod: SizingMethod;
  sizingValue: number;
  maxOrderSize: number;
  maxExposure: number;
  allowShort: boolean;
  tickerOverride: string | null;
}

export interface Order {
  id: string;
  signalId: string;
  ticker: string;
  action: SignalAction;
  side: 'achat' | 'vente';
  quantity: number;
  orderType: string;
  limitPrice: number | null;
  stopPrice: number | null;
  timeInForce: string;
  status: OrderStatus;
  strategyId: string;
  strategyName: string;
  connectionId: string;
  connectionName: string;
  brokerOrderId: string | null;
  filledQty: number;
  avgFillPrice: number | null;
  rejectionReason: string | null;
  receivedAt: string;
  submittedAt: string | null;
  executedAt: string | null;
  /** Broker route that handled the order: 'simulation' or a real adapter. */
  executionVenue: string;
}

export interface SignalLog {
  id: string;
  signalId: string;
  ticker: string;
  action: SignalAction;
  strategyName: string;
  source: string;
  status: SignalStatus;
  reason: string | null;
  subscriptionsTargeted: number;
  receivedAt: string;
}

export interface Position {
  id: string;
  ticker: string;
  connectionName: string;
  qty: number;
  side: 'long' | 'short';
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface RiskRule {
  id: string;
  label: string;
  description: string;
  value: string;
  enabled: boolean;
  triggered: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  severity: Severity;
}

export interface NotificationItem {
  id: string;
  type: 'signal' | 'ordre' | 'connexion' | 'risque' | 'systeme';
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: string;
  read: boolean;
}

export interface PlatformSettings {
  killSwitch: boolean;
}

/** Full application state returned by GET /api/state. */
export interface AppState {
  strategies: Strategy[];
  connections: Connection[];
  subscriptions: Subscription[];
  orders: Order[];
  signalLogs: SignalLog[];
  positions: Position[];
  riskRules: RiskRule[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  killSwitch: boolean;
  counts: {
    orders: number;
    signalLogs: number;
    auditLogs: number;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface IncomingSignal {
  signalId: string;
  webhookId: string;
  ticker: string;
  action: SignalAction;
  quantity?: number;
  price?: number;
  stopLoss?: number;
  orderType?: string;
  source: string;
  receivedAt: string;
  /** Timestamp declared by the emitter, used to measure signal staleness. */
  emittedAt?: string;
}

export interface RealizedTrade {
  id: string;
  ticker: string;
  connectionName: string;
  quantity: number;
  pnl: number;
  closedAt: string;
}

export interface SignalResult {
  log: SignalLog;
  orders: Order[];
}
