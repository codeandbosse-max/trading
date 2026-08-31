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
}

export interface SignalLog {
  id: string;
  signalId: string;
  ticker: string;
  action: SignalAction;
  strategyName: string;
  source: string;
  status: 'accepte' | 'rejete' | 'duplique' | 'expire';
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
  severity: 'info' | 'warning' | 'critical';
}

export interface NotificationItem {
  id: string;
  type: 'signal' | 'ordre' | 'connexion' | 'risque' | 'systeme';
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export const strategies: Strategy[] = [
  {
    id: 'strat-001',
    name: 'MACD Swing',
    description: 'Stratégie de swing trading basée sur les croisements MACD et confirmation de tendance.',
    status: 'active',
    assetClass: 'actions',
    allowedActions: ['buy', 'sell', 'exit'],
    whitelist: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'],
    blacklist: ['Penny stocks'],
    webhookId: 'wd_8f3a2b1c',
    webhookSecret: 'whsec_••••••••••••3a7f',
    maxSignalDelaySec: 30,
    rejectDuplicates: true,
    maxVolume: 500,
    maxExposure: 100000,
    defaultOrderType: 'market',
    subscriptionsCount: 3,
    signalsToday: 12,
    createdAt: '2026-07-14T09:30:00Z',
  },
  {
    id: 'strat-002',
    name: 'RSI Reversal Crypto',
    description: 'Reversal sur conditions de survente/surachat RSI sur paires crypto majeures.',
    status: 'active',
    assetClass: 'crypto',
    allowedActions: ['buy', 'sell', 'reverse'],
    whitelist: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD'],
    blacklist: [],
    webhookId: 'wd_2c4d6e8f',
    webhookSecret: 'whsec_••••••••••••9b1e',
    maxSignalDelaySec: 15,
    rejectDuplicates: true,
    maxVolume: 2,
    maxExposure: 50000,
    defaultOrderType: 'limit',
    subscriptionsCount: 2,
    signalsToday: 7,
    createdAt: '2026-07-22T14:10:00Z',
  },
  {
    id: 'strat-003',
    name: 'Futures Breakout',
    description: 'Breakout sur contrats futures ES et NQ avec filtre de volatilité.',
    status: 'suspendue',
    assetClass: 'futures',
    allowedActions: ['buy', 'sell', 'short', 'cover'],
    whitelist: ['ES', 'NQ', 'CL', 'GC'],
    blacklist: [],
    webhookId: 'wd_9a0b1c2d',
    webhookSecret: 'whsec_••••••••••••4f2a',
    maxSignalDelaySec: 10,
    rejectDuplicates: true,
    maxVolume: 10,
    maxExposure: 75000,
    defaultOrderType: 'stop',
    subscriptionsCount: 1,
    signalsToday: 0,
    createdAt: '2026-08-01T11:00:00Z',
  },
  {
    id: 'strat-004',
    name: 'ETF Rotation Mensuelle',
    description: 'Rotation sectorielle mensuelle entre ETF SPDR avec signal de momentum.',
    status: 'brouillon',
    assetClass: 'etf',
    allowedActions: ['buy', 'sell', 'exit'],
    whitelist: ['SPY', 'QQQ', 'IWM', 'XLK', 'XLF', 'XLE'],
    blacklist: [],
    webhookId: 'wd_5e6f7a8b',
    webhookSecret: 'whsec_••••••••••••7c3d',
    maxSignalDelaySec: 120,
    rejectDuplicates: false,
    maxVolume: 1000,
    maxExposure: 200000,
    defaultOrderType: 'market',
    subscriptionsCount: 0,
    signalsToday: 0,
    createdAt: '2026-08-18T16:45:00Z',
  },
];

export const connections: Connection[] = [
  {
    id: 'conn-001',
    name: 'Alpaca Paper Principal',
    broker: 'Alpaca',
    env: 'simulation',
    status: 'actif',
    currency: 'USD',
    buyingPower: 100000,
    equity: 84320.55,
    positionsCount: 4,
    lastTestAt: '2026-08-25T07:12:00Z',
    allowedInstruments: ['actions', 'etf'],
  },
  {
    id: 'conn-002',
    name: 'Interactive Brokers Live',
    broker: 'Interactive Brokers',
    env: 'reel',
    status: 'actif',
    currency: 'USD',
    buyingPower: 50000,
    equity: 142800.0,
    positionsCount: 6,
    lastTestAt: '2026-08-25T06:55:00Z',
    allowedInstruments: ['actions', 'options', 'futures', 'forex'],
  },
  {
    id: 'conn-003',
    name: 'Binance Testnet',
    broker: 'Binance',
    env: 'demonstration',
    status: 'actif',
    currency: 'USDT',
    buyingPower: 25000,
    equity: 23110.42,
    positionsCount: 2,
    lastTestAt: '2026-08-25T07:00:00Z',
    allowedInstruments: ['crypto'],
  },
  {
    id: 'conn-004',
    name: 'TopstepX Prop ES',
    broker: 'Topstep',
    env: 'simulation',
    status: 'expire',
    currency: 'USD',
    buyingPower: 0,
    equity: 0,
    positionsCount: 0,
    lastTestAt: '2026-08-20T14:30:00Z',
    allowedInstruments: ['futures'],
  },
];

export const subscriptions: Subscription[] = [
  {
    id: 'sub-001',
    strategyId: 'strat-001',
    connectionId: 'conn-001',
    enabled: true,
    executionMode: 'automatique',
    sizingMethod: 'pourcentage_capital',
    sizingValue: 10,
    maxOrderSize: 500,
    maxExposure: 50000,
    allowShort: false,
    tickerOverride: null,
  },
  {
    id: 'sub-002',
    strategyId: 'strat-001',
    connectionId: 'conn-002',
    enabled: true,
    executionMode: 'validation_manuelle',
    sizingMethod: 'montant_monetaire',
    sizingValue: 5000,
    maxOrderSize: 200,
    maxExposure: 40000,
    allowShort: true,
    tickerOverride: null,
  },
  {
    id: 'sub-003',
    strategyId: 'strat-001',
    connectionId: 'conn-004',
    enabled: false,
    executionMode: 'simulation',
    sizingMethod: 'quantite_fixe',
    sizingValue: 50,
    maxOrderSize: 50,
    maxExposure: 10000,
    allowShort: false,
    tickerOverride: null,
  },
  {
    id: 'sub-004',
    strategyId: 'strat-002',
    connectionId: 'conn-003',
    enabled: true,
    executionMode: 'automatique',
    sizingMethod: 'risque_par_trade',
    sizingValue: 2,
    maxOrderSize: 1,
    maxExposure: 20000,
    allowShort: true,
    tickerOverride: null,
  },
  {
    id: 'sub-005',
    strategyId: 'strat-002',
    connectionId: 'conn-001',
    enabled: true,
    executionMode: 'simulation',
    sizingMethod: 'taille_du_signal',
    sizingValue: 0,
    maxOrderSize: 2,
    maxExposure: 15000,
    allowShort: false,
    tickerOverride: 'BTC-USD',
  },
];

export const orders: Order[] = [
  {
    id: 'ord-2026-0001',
    signalId: 'tv-20260825-000123',
    ticker: 'AAPL',
    action: 'buy',
    side: 'achat',
    quantity: 50,
    orderType: 'market',
    limitPrice: null,
    stopPrice: null,
    timeInForce: 'day',
    status: 'execute',
    strategyId: 'strat-001',
    strategyName: 'MACD Swing',
    connectionId: 'conn-001',
    connectionName: 'Alpaca Paper Principal',
    brokerOrderId: 'ALP-7741',
    filledQty: 50,
    avgFillPrice: 212.34,
    rejectionReason: null,
    receivedAt: '2026-08-25T13:20:02Z',
    submittedAt: '2026-08-25T13:20:03Z',
    executedAt: '2026-08-25T13:20:04Z',
  },
  {
    id: 'ord-2026-0002',
    signalId: 'tv-20260825-000123',
    ticker: 'AAPL',
    action: 'buy',
    side: 'achat',
    quantity: 24,
    orderType: 'limit',
    limitPrice: 211.50,
    stopPrice: null,
    timeInForce: 'gtc',
    status: 'en_attente_validation',
    strategyId: 'strat-001',
    strategyName: 'MACD Swing',
    connectionId: 'conn-002',
    connectionName: 'Interactive Brokers Live',
    brokerOrderId: null,
    filledQty: 0,
    avgFillPrice: null,
    rejectionReason: null,
    receivedAt: '2026-08-25T13:20:02Z',
    submittedAt: null,
    executedAt: null,
  },
  {
    id: 'ord-2026-0003',
    signalId: 'tv-20260825-000124',
    ticker: 'NVDA',
    action: 'sell',
    side: 'vente',
    quantity: 30,
    orderType: 'market',
    limitPrice: null,
    stopPrice: null,
    timeInForce: 'day',
    status: 'execute',
    strategyId: 'strat-001',
    strategyName: 'MACD Swing',
    connectionId: 'conn-001',
    connectionName: 'Alpaca Paper Principal',
    brokerOrderId: 'ALP-7742',
    filledQty: 30,
    avgFillPrice: 128.72,
    rejectionReason: null,
    receivedAt: '2026-08-25T13:35:11Z',
    submittedAt: '2026-08-25T13:35:12Z',
    executedAt: '2026-08-25T13:35:13Z',
  },
  {
    id: 'ord-2026-0004',
    signalId: 'tv-20260825-000125',
    ticker: 'BTC-USD',
    action: 'buy',
    side: 'achat',
    quantity: 0.5,
    orderType: 'limit',
    limitPrice: 59000,
    stopPrice: null,
    timeInForce: 'gtc',
    status: 'execute_partiellement',
    strategyId: 'strat-002',
    strategyName: 'RSI Reversal Crypto',
    connectionId: 'conn-003',
    connectionName: 'Binance Testnet',
    brokerOrderId: 'BIN-9921',
    filledQty: 0.3,
    avgFillPrice: 59120.0,
    rejectionReason: null,
    receivedAt: '2026-08-25T14:01:00Z',
    submittedAt: '2026-08-25T14:01:01Z',
    executedAt: null,
  },
  {
    id: 'ord-2026-0005',
    signalId: 'tv-20260825-000126',
    ticker: 'TSLA',
    action: 'short',
    side: 'vente',
    quantity: 100,
    orderType: 'market',
    limitPrice: null,
    stopPrice: null,
    timeInForce: 'day',
    status: 'rejete',
    strategyId: 'strat-001',
    strategyName: 'MACD Swing',
    connectionId: 'conn-001',
    connectionName: 'Alpaca Paper Principal',
    brokerOrderId: null,
    filledQty: 0,
    avgFillPrice: null,
    rejectionReason: 'Vente à découvert non autorisée pour cette souscription.',
    receivedAt: '2026-08-25T14:15:22Z',
    submittedAt: null,
    executedAt: null,
  },
  {
    id: 'ord-2026-0006',
    signalId: 'tv-20260825-000127',
    ticker: 'MSFT',
    action: 'buy',
    side: 'achat',
    quantity: 40,
    orderType: 'limit',
    limitPrice: 415.0,
    stopPrice: null,
    timeInForce: 'day',
    status: 'soumis',
    strategyId: 'strat-001',
    strategyName: 'MACD Swing',
    connectionId: 'conn-001',
    connectionName: 'Alpaca Paper Principal',
    brokerOrderId: 'ALP-7743',
    filledQty: 0,
    avgFillPrice: null,
    rejectionReason: null,
    receivedAt: '2026-08-25T14:30:05Z',
    submittedAt: '2026-08-25T14:30:06Z',
    executedAt: null,
  },
  {
    id: 'ord-2026-0007',
    signalId: 'tv-20260825-000128',
    ticker: 'ETH-USD',
    action: 'sell',
    side: 'vente',
    quantity: 5,
    orderType: 'market',
    limitPrice: null,
    stopPrice: null,
    timeInForce: 'gtc',
    status: 'envoi_en_cours',
    strategyId: 'strat-002',
    strategyName: 'RSI Reversal Crypto',
    connectionId: 'conn-003',
    connectionName: 'Binance Testnet',
    brokerOrderId: null,
    filledQty: 0,
    avgFillPrice: null,
    rejectionReason: null,
    receivedAt: '2026-08-25T14:42:00Z',
    submittedAt: null,
    executedAt: null,
  },
  {
    id: 'ord-2026-0008',
    signalId: 'tv-20260825-000129',
    ticker: 'AMZN',
    action: 'buy',
    side: 'achat',
    quantity: 20,
    orderType: 'market',
    limitPrice: null,
    stopPrice: null,
    timeInForce: 'day',
    status: 'erreur',
    strategyId: 'strat-001',
    strategyName: 'MACD Swing',
    connectionId: 'conn-004',
    connectionName: 'TopstepX Prop ES',
    brokerOrderId: null,
    filledQty: 0,
    avgFillPrice: null,
    rejectionReason: 'Connexion au broker indisponible (token expiré).',
    receivedAt: '2026-08-25T14:50:30Z',
    submittedAt: null,
    executedAt: null,
  },
];

export const signalLogs: SignalLog[] = [
  {
    id: 'sig-001',
    signalId: 'tv-20260825-000123',
    ticker: 'AAPL',
    action: 'buy',
    strategyName: 'MACD Swing',
    source: 'TradingView',
    status: 'accepte',
    reason: null,
    subscriptionsTargeted: 3,
    receivedAt: '2026-08-25T13:20:02Z',
  },
  {
    id: 'sig-002',
    signalId: 'tv-20260825-000124',
    ticker: 'NVDA',
    action: 'sell',
    strategyName: 'MACD Swing',
    source: 'TradingView',
    status: 'accepte',
    reason: null,
    subscriptionsTargeted: 2,
    receivedAt: '2026-08-25T13:35:11Z',
  },
  {
    id: 'sig-003',
    signalId: 'tv-20260825-000125',
    ticker: 'BTC-USD',
    action: 'buy',
    strategyName: 'RSI Reversal Crypto',
    source: 'TrendSpider',
    status: 'accepte',
    reason: null,
    subscriptionsTargeted: 2,
    receivedAt: '2026-08-25T14:01:00Z',
  },
  {
    id: 'sig-004',
    signalId: 'tv-20260825-000126',
    ticker: 'TSLA',
    action: 'short',
    strategyName: 'MACD Swing',
    source: 'TradingView',
    status: 'rejete',
    reason: 'Action short non autorisée par la stratégie.',
    subscriptionsTargeted: 0,
    receivedAt: '2026-08-25T14:15:22Z',
  },
  {
    id: 'sig-005',
    signalId: 'tv-20260825-000123',
    ticker: 'AAPL',
    action: 'buy',
    strategyName: 'MACD Swing',
    source: 'TradingView',
    status: 'duplique',
    reason: 'signal_id déjà reçu dans les 60 dernières secondes.',
    subscriptionsTargeted: 0,
    receivedAt: '2026-08-25T14:18:00Z',
  },
  {
    id: 'sig-006',
    signalId: 'tv-20260825-000127',
    ticker: 'MSFT',
    action: 'buy',
    strategyName: 'MACD Swing',
    source: 'Custom Python',
    status: 'accepte',
    reason: null,
    subscriptionsTargeted: 2,
    receivedAt: '2026-08-25T14:30:05Z',
  },
  {
    id: 'sig-007',
    signalId: 'tv-20260825-000128',
    ticker: 'ETH-USD',
    action: 'sell',
    strategyName: 'RSI Reversal Crypto',
    source: 'TrendSpider',
    status: 'accepte',
    reason: null,
    subscriptionsTargeted: 1,
    receivedAt: '2026-08-25T14:42:00Z',
  },
  {
    id: 'sig-008',
    signalId: 'tv-20260824-000099',
    ticker: 'EURUSD',
    action: 'buy',
    strategyName: 'Futures Breakout',
    source: 'TradingView',
    status: 'expire',
    reason: 'Signal reçu 45s après émission (délai max: 10s).',
    subscriptionsTargeted: 0,
    receivedAt: '2026-08-25T08:10:00Z',
  },
];

export const positions: Position[] = [
  {
    id: 'pos-001',
    ticker: 'AAPL',
    connectionName: 'Alpaca Paper Principal',
    qty: 50,
    side: 'long',
    avgPrice: 212.34,
    currentPrice: 214.80,
    marketValue: 10740.0,
    pnl: 123.0,
    pnlPercent: 1.16,
  },
  {
    id: 'pos-002',
    ticker: 'NVDA',
    connectionName: 'Alpaca Paper Principal',
    qty: 30,
    side: 'short',
    avgPrice: 128.72,
    currentPrice: 125.10,
    marketValue: 3753.0,
    pnl: 108.6,
    pnlPercent: 2.81,
  },
  {
    id: 'pos-003',
    ticker: 'MSFT',
    connectionName: 'Interactive Brokers Live',
    qty: 120,
    side: 'long',
    avgPrice: 410.25,
    currentPrice: 418.60,
    marketValue: 50232.0,
    pnl: 1002.0,
    pnlPercent: 2.04,
  },
  {
    id: 'pos-004',
    ticker: 'BTC-USD',
    connectionName: 'Binance Testnet',
    qty: 0.3,
    side: 'long',
    avgPrice: 59120.0,
    currentPrice: 58950.0,
    marketValue: 17685.0,
    pnl: -51.0,
    pnlPercent: -0.29,
  },
  {
    id: 'pos-005',
    ticker: 'META',
    connectionName: 'Interactive Brokers Live',
    qty: 40,
    side: 'long',
    avgPrice: 502.10,
    currentPrice: 498.20,
    marketValue: 19928.0,
    pnl: -156.0,
    pnlPercent: -0.78,
  },
  {
    id: 'pos-006',
    ticker: 'ETH-USD',
    connectionName: 'Binance Testnet',
    qty: 2,
    side: 'long',
    avgPrice: 2620.0,
    currentPrice: 2685.5,
    marketValue: 5371.0,
    pnl: 131.0,
    pnlPercent: 2.5,
  },
];

export const riskRules: RiskRule[] = [
  {
    id: 'risk-001',
    label: 'Montant maximal par ordre',
    description: 'Aucun ordre ne peut dépasser ce montant en valeur.',
    value: '25 000 $',
    enabled: true,
    triggered: false,
  },
  {
    id: 'risk-002',
    label: 'Quantité maximale par ordre',
    description: 'Nombre maximum d’unités par ordre individuel.',
    value: '500',
    enabled: true,
    triggered: false,
  },
  {
    id: 'risk-003',
    label: 'Position maximale par ticker',
    description: 'Exposition maximale sur un seul instrument.',
    value: '50 000 $',
    enabled: true,
    triggered: false,
  },
  {
    id: 'risk-004',
    label: 'Exposition maximale par compte',
    description: 'Valeur totale maximale des positions ouvertes par compte.',
    value: '100 000 $',
    enabled: true,
    triggered: true,
  },
  {
    id: 'risk-005',
    label: 'Ordres par jour',
    description: 'Nombre maximal d’ordres soumis par jour calendaire.',
    value: '50',
    enabled: true,
    triggered: false,
  },
  {
    id: 'risk-006',
    label: 'Perte journalière maximale',
    description: 'Suspend automatiquement les stratégies en mode réel si atteinte.',
    value: '3 000 $',
    enabled: true,
    triggered: false,
  },
  {
    id: 'risk-007',
    label: 'Pertes consécutives maximales',
    description: 'Suspend les souscriptions après ce nombre de pertes d’affilée.',
    value: '5',
    enabled: false,
    triggered: false,
  },
  {
    id: 'risk-008',
    label: 'Stop-loss obligatoire',
    description: 'Exige un stop-loss sur les stratégies futures et crypto.',
    value: 'Activé (futures, crypto)',
    enabled: true,
    triggered: false,
  },
  {
    id: 'risk-009',
    label: 'Validation manuelle au-delà de',
    description: 'Les ordres dépassant ce montant nécessitent une approbation manuelle.',
    value: '10 000 $',
    enabled: true,
    triggered: false,
  },
  {
    id: 'risk-010',
    label: 'Plage horaire autorisée',
    description: 'Refuse les ordres en dehors des heures de marché configurées.',
    value: '09:30–16:00 ET',
    enabled: true,
    triggered: false,
  },
];

export const auditLogs: AuditLog[] = [
  {
    id: 'aud-001',
    timestamp: '2026-08-25T14:50:30Z',
    actor: 'système',
    action: 'Échec d’envoi d’ordre',
    target: 'conn-004 / TopstepX Prop ES',
    ip: '—',
    severity: 'critical',
  },
  {
    id: 'aud-002',
    timestamp: '2026-08-25T14:15:22Z',
    actor: 'moteur de risque',
    action: 'Ordre rejeté (short interdit)',
    target: 'strat-001 / TSLA',
    ip: '—',
    severity: 'warning',
  },
  {
    id: 'aud-003',
    timestamp: '2026-08-25T13:20:02Z',
    actor: 'webhook',
    action: 'Signal reçu et accepté',
    target: 'tv-20260825-000123',
    ip: '52.84.10.22',
    severity: 'info',
  },
  {
    id: 'aud-004',
    timestamp: '2026-08-25T09:00:00Z',
    actor: 'alex@signdesk.io',
    action: 'Connexion réussie (TOTP validé)',
    target: '—',
    ip: '82.65.12.4',
    severity: 'info',
  },
  {
    id: 'aud-005',
    timestamp: '2026-08-25T08:10:00Z',
    actor: 'moteur de risque',
    action: 'Signal expiré rejeté',
    target: 'tv-20260824-000099',
    ip: '—',
    severity: 'warning',
  },
  {
    id: 'aud-006',
    timestamp: '2026-08-24T18:33:00Z',
    actor: 'alex@signdesk.io',
    action: 'Régénération du secret de webhook',
    target: 'strat-002',
    ip: '82.65.12.4',
    severity: 'warning',
  },
  {
    id: 'aud-007',
    timestamp: '2026-08-24T16:20:00Z',
    actor: 'alex@signdesk.io',
    action: 'Création de stratégie',
    target: 'strat-004 / ETF Rotation Mensuelle',
    ip: '82.65.12.4',
    severity: 'info',
  },
  {
    id: 'aud-008',
    timestamp: '2026-08-24T11:05:00Z',
    actor: 'système',
    action: 'Test de connectivité broker réussi',
    target: 'conn-002 / Interactive Brokers',
    ip: '—',
    severity: 'info',
  },
];

export const notifications: NotificationItem[] = [
  {
    id: 'not-001',
    type: 'connexion',
    title: 'Connexion expirée',
    message: 'La connexion TopstepX Prop ES a expiré. Veuillez renouveler le token.',
    severity: 'error',
    timestamp: '2026-08-25T14:50:30Z',
    read: false,
  },
  {
    id: 'not-002',
    type: 'risque',
    title: 'Exposition maximale atteinte',
    message: 'Le compte Alpaca Paper Principal a atteint 92% de l’exposition maximale configurée.',
    severity: 'warning',
    timestamp: '2026-08-25T13:45:00Z',
    read: false,
  },
  {
    id: 'not-003',
    type: 'ordre',
    title: 'Ordre exécuté',
    message: 'AAPL — 50 actions exécutées à 212,34 $ sur Alpaca Paper Principal.',
    severity: 'success',
    timestamp: '2026-08-25T13:20:04Z',
    read: true,
  },
  {
    id: 'not-004',
    type: 'signal',
    title: 'Signal rejeté',
    message: 'TSLA short — action non autorisée par la stratégie MACD Swing.',
    severity: 'warning',
    timestamp: '2026-08-25T14:15:22Z',
    read: false,
  },
  {
    id: 'not-005',
    type: 'ordre',
    title: 'Validation manuelle requise',
    message: 'AAPL — 24 actions en attente d’approbation sur Interactive Brokers Live.',
    severity: 'info',
    timestamp: '2026-08-25T13:20:03Z',
    read: false,
  },
];

export const signalsTimeline = [
  { hour: '08h', acceptes: 2, rejetes: 1 },
  { hour: '09h', acceptes: 4, rejetes: 0 },
  { hour: '10h', acceptes: 3, rejetes: 0 },
  { hour: '11h', acceptes: 5, rejetes: 1 },
  { hour: '12h', acceptes: 2, rejetes: 0 },
  { hour: '13h', acceptes: 6, rejetes: 1 },
  { hour: '14h', acceptes: 4, rejetes: 2 },
];

export const ordersByStatus = [
  { status: 'Exécuté', count: 18, fill: 'hsl(var(--success))' },
  { status: 'Soumis', count: 4, fill: 'hsl(var(--chart-5))' },
  { status: 'En attente', count: 3, fill: 'hsl(var(--warning))' },
  { status: 'Rejeté', count: 2, fill: 'hsl(var(--destructive))' },
  { status: 'Erreur', count: 1, fill: 'hsl(var(--muted-foreground))' },
];

export const pnlSeries = [
  { day: 'Lun', pnl: 420 },
  { day: 'Mar', pnl: -180 },
  { day: 'Mer', pnl: 610 },
  { day: 'Jeu', pnl: 240 },
  { day: 'Ven', pnl: -90 },
  { day: 'Sam', pnl: 0 },
  { day: 'Dim', pnl: 0 },
];

export const platformStats = {
  totalSignals: 19,
  acceptedSignals: 15,
  rejectedSignals: 4,
  successRate: 78.9,
  totalOrders: 28,
  openPositions: 6,
  activeStrategies: 2,
  activeConnections: 3,
  killSwitchActive: false,
  pnlToday: 123.6,
  pnlWeek: 1000.0,
};
