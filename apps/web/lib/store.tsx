'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  strategies as seedStrategies,
  connections as seedConnections,
  subscriptions as seedSubscriptions,
  orders as seedOrders,
  signalLogs as seedSignalLogs,
  positions as seedPositions,
  riskRules as seedRiskRules,
  auditLogs as seedAuditLogs,
  notifications as seedNotifications,
  platformStats,
  type Strategy,
  type Connection,
  type Subscription,
  type Order,
  type SignalLog,
  type Position,
  type RiskRule,
  type AuditLog,
  type NotificationItem,
  type SignalAction,
  type OrderStatus,
} from '@/lib/mock-data';

const STORAGE_KEY = 'signaldesk.state.v1';
const CURRENT_ACTOR = 'alex.moreau@signaldesk.io';

export interface IncomingSignal {
  signalId: string;
  ticker: string;
  action: SignalAction;
  quantity?: number;
  price?: number;
  orderType?: string;
  source: string;
  receivedAt: string;
  webhookId: string;
}

export interface StoreState {
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
  liveFeed: boolean;
  processedSignalIds: string[];
}

function seed(): StoreState {
  return {
    strategies: seedStrategies,
    connections: seedConnections,
    subscriptions: seedSubscriptions,
    orders: seedOrders,
    signalLogs: seedSignalLogs,
    positions: seedPositions,
    riskRules: seedRiskRules,
    auditLogs: seedAuditLogs,
    notifications: seedNotifications,
    killSwitch: platformStats.killSwitchActive,
    liveFeed: false,
    processedSignalIds: [],
  };
}

function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${rand}`;
}

/** Generates a webhook secret. Display-only value; the signing secret lives server-side. */
function newSecret(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `whsec_${hex}`;
}

type Action =
  | { type: 'hydrate'; state: StoreState }
  | { type: 'reset' }
  | { type: 'strategy/upsert'; strategy: Strategy }
  | { type: 'strategy/delete'; id: string }
  | { type: 'strategy/secret'; id: string; secret: string }
  | { type: 'connection/upsert'; connection: Connection }
  | { type: 'connection/delete'; id: string }
  | { type: 'connection/status'; id: string; status: Connection['status']; lastTestAt?: string }
  | { type: 'subscription/upsert'; subscription: Subscription }
  | { type: 'subscription/delete'; id: string }
  | { type: 'order/status'; id: string; status: OrderStatus; patch?: Partial<Order> }
  | { type: 'order/add'; order: Order }
  | { type: 'position/upsert'; position: Position }
  | { type: 'position/delete'; id: string }
  | { type: 'position/prices'; prices: Record<string, number> }
  | { type: 'risk/update'; rule: RiskRule }
  | { type: 'risk/killSwitch'; active: boolean }
  | { type: 'feed/toggle'; active: boolean }
  | { type: 'signal/log'; log: SignalLog; orders: Order[]; signalId: string }
  | { type: 'notification/add'; notification: NotificationItem }
  | { type: 'notification/read'; id: string }
  | { type: 'notification/readAll' }
  | { type: 'notification/clear' }
  | { type: 'audit'; log: AuditLog };

function audit(
  state: StoreState,
  action: string,
  target: string,
  severity: AuditLog['severity'] = 'info'
): AuditLog[] {
  const entry: AuditLog = {
    id: uid('audit'),
    timestamp: new Date().toISOString(),
    actor: CURRENT_ACTOR,
    action,
    target,
    ip: '127.0.0.1',
    severity,
  };
  return [entry, ...state.auditLogs].slice(0, 500);
}

function recountSubscriptions(state: StoreState, subs: Subscription[]): Strategy[] {
  return state.strategies.map((s) => ({
    ...s,
    subscriptionsCount: subs.filter((sub) => sub.strategyId === s.id).length,
  }));
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'reset':
      return seed();

    case 'strategy/upsert': {
      const exists = state.strategies.some((s) => s.id === action.strategy.id);
      return {
        ...state,
        strategies: exists
          ? state.strategies.map((s) => (s.id === action.strategy.id ? action.strategy : s))
          : [action.strategy, ...state.strategies],
        auditLogs: audit(
          state,
          exists ? 'strategie.modification' : 'strategie.creation',
          action.strategy.name
        ),
      };
    }

    case 'strategy/delete': {
      const strategy = state.strategies.find((s) => s.id === action.id);
      const subs = state.subscriptions.filter((sub) => sub.strategyId !== action.id);
      return {
        ...state,
        strategies: state.strategies.filter((s) => s.id !== action.id),
        subscriptions: subs,
        auditLogs: audit(state, 'strategie.suppression', strategy?.name ?? action.id, 'warning'),
      };
    }

    case 'strategy/secret': {
      const strategy = state.strategies.find((s) => s.id === action.id);
      return {
        ...state,
        strategies: state.strategies.map((s) =>
          s.id === action.id ? { ...s, webhookSecret: action.secret } : s
        ),
        auditLogs: audit(
          state,
          'webhook.rotation_secret',
          strategy?.name ?? action.id,
          'warning'
        ),
      };
    }

    case 'connection/upsert': {
      const exists = state.connections.some((c) => c.id === action.connection.id);
      return {
        ...state,
        connections: exists
          ? state.connections.map((c) => (c.id === action.connection.id ? action.connection : c))
          : [action.connection, ...state.connections],
        auditLogs: audit(
          state,
          exists ? 'connexion.modification' : 'connexion.creation',
          action.connection.name
        ),
      };
    }

    case 'connection/delete': {
      const connection = state.connections.find((c) => c.id === action.id);
      return {
        ...state,
        connections: state.connections.filter((c) => c.id !== action.id),
        subscriptions: state.subscriptions.filter((s) => s.connectionId !== action.id),
        auditLogs: audit(state, 'connexion.suppression', connection?.name ?? action.id, 'warning'),
      };
    }

    case 'connection/status': {
      const connection = state.connections.find((c) => c.id === action.id);
      return {
        ...state,
        connections: state.connections.map((c) =>
          c.id === action.id
            ? { ...c, status: action.status, lastTestAt: action.lastTestAt ?? c.lastTestAt }
            : c
        ),
        auditLogs: audit(
          state,
          'connexion.changement_etat',
          `${connection?.name ?? action.id} → ${action.status}`,
          action.status === 'actif' ? 'info' : 'warning'
        ),
      };
    }

    case 'subscription/upsert': {
      const exists = state.subscriptions.some((s) => s.id === action.subscription.id);
      const subs = exists
        ? state.subscriptions.map((s) =>
            s.id === action.subscription.id ? action.subscription : s
          )
        : [action.subscription, ...state.subscriptions];
      return {
        ...state,
        subscriptions: subs,
        strategies: recountSubscriptions(state, subs),
        auditLogs: audit(
          state,
          exists ? 'abonnement.modification' : 'abonnement.creation',
          action.subscription.id
        ),
      };
    }

    case 'subscription/delete': {
      const subs = state.subscriptions.filter((s) => s.id !== action.id);
      return {
        ...state,
        subscriptions: subs,
        strategies: recountSubscriptions(state, subs),
        auditLogs: audit(state, 'abonnement.suppression', action.id, 'warning'),
      };
    }

    case 'order/add':
      return { ...state, orders: [action.order, ...state.orders] };

    case 'order/status': {
      const order = state.orders.find((o) => o.id === action.id);
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.id ? { ...o, ...action.patch, status: action.status } : o
        ),
        auditLogs: audit(
          state,
          `ordre.${action.status}`,
          `${order?.ticker ?? action.id} (${action.id})`,
          action.status === 'annule' || action.status === 'rejete' ? 'warning' : 'info'
        ),
      };
    }

    case 'position/upsert': {
      const exists = state.positions.some((p) => p.id === action.position.id);
      return {
        ...state,
        positions: exists
          ? state.positions.map((p) => (p.id === action.position.id ? action.position : p))
          : [action.position, ...state.positions],
      };
    }

    case 'position/delete': {
      const position = state.positions.find((p) => p.id === action.id);
      return {
        ...state,
        positions: state.positions.filter((p) => p.id !== action.id),
        auditLogs: audit(state, 'position.cloture', position?.ticker ?? action.id),
      };
    }

    case 'position/prices': {
      return {
        ...state,
        positions: state.positions.map((p) => {
          const price = action.prices[p.ticker];
          if (price === undefined) return p;
          const marketValue = price * p.qty * (p.side === 'short' ? -1 : 1);
          const pnl =
            (p.side === 'short' ? p.avgPrice - price : price - p.avgPrice) * p.qty;
          const pnlPercent = p.avgPrice === 0 ? 0 : (pnl / (p.avgPrice * p.qty)) * 100;
          return { ...p, currentPrice: price, marketValue, pnl, pnlPercent };
        }),
      };
    }

    case 'risk/update':
      return {
        ...state,
        riskRules: state.riskRules.map((r) => (r.id === action.rule.id ? action.rule : r)),
        auditLogs: audit(state, 'risque.regle_modifiee', action.rule.label),
      };

    case 'risk/killSwitch':
      return {
        ...state,
        killSwitch: action.active,
        auditLogs: audit(
          state,
          action.active ? 'risque.coupe_circuit_active' : 'risque.coupe_circuit_desactive',
          'Plateforme',
          'critical'
        ),
      };

    case 'feed/toggle':
      return { ...state, liveFeed: action.active };

    case 'signal/log':
      return {
        ...state,
        signalLogs: [action.log, ...state.signalLogs].slice(0, 300),
        orders: [...action.orders, ...state.orders].slice(0, 300),
        processedSignalIds: [action.signalId, ...state.processedSignalIds].slice(0, 200),
      };

    case 'notification/add':
      return {
        ...state,
        notifications: [action.notification, ...state.notifications].slice(0, 100),
      };

    case 'notification/read':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n
        ),
      };

    case 'notification/readAll':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };

    case 'notification/clear':
      return { ...state, notifications: [] };

    case 'audit':
      return { ...state, auditLogs: [action.log, ...state.auditLogs].slice(0, 500) };

    default:
      return state;
  }
}

/** Numeric portion of a risk rule value such as "5 000 USD" or "3 %". */
function ruleNumber(rules: RiskRule[], id: string): number | null {
  const rule = rules.find((r) => r.id === id);
  if (!rule || !rule.enabled) return null;
  const digits = rule.value.replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface RiskDecision {
  allowed: boolean;
  reason: string | null;
}

export function evaluateRisk(
  state: StoreState,
  strategy: Strategy,
  subscription: Subscription,
  signal: IncomingSignal,
  quantity: number,
  price: number
): RiskDecision {
  if (state.killSwitch) {
    return { allowed: false, reason: 'Coupe-circuit actif : toute exécution est bloquée.' };
  }
  if (strategy.status !== 'active') {
    return { allowed: false, reason: `Stratégie ${strategy.status}, signal ignoré.` };
  }
  if (!subscription.enabled) {
    return { allowed: false, reason: 'Abonnement désactivé.' };
  }
  if (!strategy.allowedActions.includes(signal.action)) {
    return { allowed: false, reason: `Action "${signal.action}" non autorisée par la stratégie.` };
  }
  const ticker = subscription.tickerOverride ?? signal.ticker;
  if (strategy.whitelist.length > 0 && !strategy.whitelist.includes(ticker)) {
    return { allowed: false, reason: `${ticker} absent de la liste blanche.` };
  }
  if (strategy.blacklist.includes(ticker)) {
    return { allowed: false, reason: `${ticker} figure sur la liste noire.` };
  }
  if ((signal.action === 'short' || signal.action === 'sell') && !subscription.allowShort) {
    if (signal.action === 'short') {
      return { allowed: false, reason: 'Vente à découvert interdite sur cet abonnement.' };
    }
  }
  const ageSec = (Date.now() - new Date(signal.receivedAt).getTime()) / 1000;
  if (ageSec > strategy.maxSignalDelaySec) {
    return {
      allowed: false,
      reason: `Signal expiré (${Math.round(ageSec)}s > ${strategy.maxSignalDelaySec}s).`,
    };
  }
  if (quantity > strategy.maxVolume) {
    return {
      allowed: false,
      reason: `Volume ${quantity} supérieur au maximum ${strategy.maxVolume}.`,
    };
  }
  if (quantity > subscription.maxOrderSize) {
    return {
      allowed: false,
      reason: `Taille d'ordre ${quantity} supérieure au plafond ${subscription.maxOrderSize}.`,
    };
  }
  const notional = quantity * price;
  if (notional > subscription.maxExposure) {
    return { allowed: false, reason: `Exposition ${notional.toFixed(0)} au-dessus du plafond.` };
  }
  const maxNotional = ruleNumber(state.riskRules, 'risk-001');
  if (maxNotional !== null && notional > maxNotional) {
    return { allowed: false, reason: `Notionnel ${notional.toFixed(0)} > règle de risque globale.` };
  }
  const connection = state.connections.find((c) => c.id === subscription.connectionId);
  if (!connection) return { allowed: false, reason: 'Connexion introuvable.' };
  if (connection.status !== 'actif') {
    return { allowed: false, reason: `Connexion ${connection.name} indisponible.` };
  }
  if (notional > connection.buyingPower) {
    return { allowed: false, reason: 'Pouvoir d’achat insuffisant.' };
  }
  return { allowed: true, reason: null };
}

function sizeOrder(subscription: Subscription, connection: Connection, price: number, signalQty?: number): number {
  switch (subscription.sizingMethod) {
    case 'quantite_fixe':
      return subscription.sizingValue;
    case 'taille_du_signal':
      return signalQty ?? subscription.sizingValue;
    case 'pourcentage_capital':
      return price > 0
        ? Math.max(1, Math.floor((connection.equity * (subscription.sizingValue / 100)) / price))
        : 0;
    case 'montant_monetaire':
      return price > 0 ? Math.max(1, Math.floor(subscription.sizingValue / price)) : 0;
    case 'risque_par_trade':
      return price > 0
        ? Math.max(1, Math.floor((connection.equity * (subscription.sizingValue / 100)) / price))
        : 0;
    default:
      return subscription.sizingValue;
  }
}

const actionToSide: Record<SignalAction, 'achat' | 'vente'> = {
  buy: 'achat',
  cover: 'achat',
  sell: 'vente',
  short: 'vente',
  exit: 'vente',
  reverse: 'achat',
};

interface StoreApi {
  state: StoreState;
  hydrated: boolean;
  createStrategy: (input: Omit<Strategy, 'id' | 'webhookId' | 'webhookSecret' | 'subscriptionsCount' | 'signalsToday' | 'createdAt'>) => Strategy;
  updateStrategy: (strategy: Strategy) => void;
  deleteStrategy: (id: string) => void;
  regenerateSecret: (id: string) => string;
  createConnection: (input: Omit<Connection, 'id' | 'lastTestAt' | 'positionsCount'>) => Connection;
  updateConnection: (connection: Connection) => void;
  deleteConnection: (id: string) => void;
  testConnection: (id: string) => Promise<boolean>;
  setConnectionEnabled: (id: string, enabled: boolean) => void;
  saveSubscription: (subscription: Subscription) => void;
  createSubscription: (input: Omit<Subscription, 'id'>) => Subscription;
  deleteSubscription: (id: string) => void;
  cancelOrder: (id: string) => void;
  approveOrder: (id: string) => void;
  rejectOrder: (id: string, reason: string) => void;
  retryOrder: (id: string) => void;
  closePosition: (id: string) => void;
  updateRiskRule: (rule: RiskRule) => void;
  setKillSwitch: (active: boolean) => void;
  setLiveFeed: (active: boolean) => void;
  ingestSignal: (signal: IncomingSignal) => void;
  simulateSignal: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  notify: (input: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoreState>;
        dispatch({ type: 'hydrate', state: { ...seed(), ...parsed } });
      }
    } catch {
      // Corrupted payload: keep the seeded state.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable: state stays in memory only.
    }
  }, [state, hydrated]);

  const notify = useCallback((input: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    dispatch({
      type: 'notification/add',
      notification: {
        ...input,
        id: uid('notif'),
        timestamp: new Date().toISOString(),
        read: false,
      },
    });
  }, []);

  const createStrategy = useCallback<StoreApi['createStrategy']>((input) => {
    const strategy: Strategy = {
      ...input,
      id: uid('strat'),
      webhookId: `wd_${uid('').slice(1)}`,
      webhookSecret: newSecret(),
      subscriptionsCount: 0,
      signalsToday: 0,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'strategy/upsert', strategy });
    return strategy;
  }, []);

  const updateStrategy = useCallback((strategy: Strategy) => {
    dispatch({ type: 'strategy/upsert', strategy });
  }, []);

  const deleteStrategy = useCallback((id: string) => {
    dispatch({ type: 'strategy/delete', id });
  }, []);

  const regenerateSecret = useCallback((id: string) => {
    const secret = newSecret();
    dispatch({ type: 'strategy/secret', id, secret });
    return secret;
  }, []);

  const createConnection = useCallback<StoreApi['createConnection']>((input) => {
    const connection: Connection = {
      ...input,
      id: uid('conn'),
      positionsCount: 0,
      lastTestAt: new Date().toISOString(),
    };
    dispatch({ type: 'connection/upsert', connection });
    return connection;
  }, []);

  const updateConnection = useCallback((connection: Connection) => {
    dispatch({ type: 'connection/upsert', connection });
  }, []);

  const deleteConnection = useCallback((id: string) => {
    dispatch({ type: 'connection/delete', id });
  }, []);

  const testConnection = useCallback<StoreApi['testConnection']>(
    async (id) => {
      const connection = stateRef.current.connections.find((c) => c.id === id);
      if (!connection) return false;
      await new Promise((resolve) => setTimeout(resolve, 700));
      const reachable = connection.status !== 'expire';
      dispatch({
        type: 'connection/status',
        id,
        status: reachable ? 'actif' : 'expire',
        lastTestAt: new Date().toISOString(),
      });
      notify({
        type: 'connexion',
        title: reachable ? 'Connexion opérationnelle' : 'Échec du test',
        message: reachable
          ? `${connection.name} a répondu correctement.`
          : `${connection.name} : identifiants expirés, renouvelez la clé API.`,
        severity: reachable ? 'success' : 'error',
      });
      return reachable;
    },
    [notify]
  );

  const setConnectionEnabled = useCallback((id: string, enabled: boolean) => {
    dispatch({ type: 'connection/status', id, status: enabled ? 'actif' : 'indisponible' });
  }, []);

  const createSubscription = useCallback<StoreApi['createSubscription']>((input) => {
    const subscription: Subscription = { ...input, id: uid('sub') };
    dispatch({ type: 'subscription/upsert', subscription });
    return subscription;
  }, []);

  const saveSubscription = useCallback((subscription: Subscription) => {
    dispatch({ type: 'subscription/upsert', subscription });
  }, []);

  const deleteSubscription = useCallback((id: string) => {
    dispatch({ type: 'subscription/delete', id });
  }, []);

  const cancelOrder = useCallback((id: string) => {
    dispatch({ type: 'order/status', id, status: 'annule' });
  }, []);

  const rejectOrder = useCallback((id: string, reason: string) => {
    dispatch({ type: 'order/status', id, status: 'rejete', patch: { rejectionReason: reason } });
  }, []);

  const approveOrder = useCallback((id: string) => {
    dispatch({
      type: 'order/status',
      id,
      status: 'soumis',
      patch: { submittedAt: new Date().toISOString() },
    });
  }, []);

  const retryOrder = useCallback((id: string) => {
    dispatch({
      type: 'order/status',
      id,
      status: 'envoi_en_cours',
      patch: { rejectionReason: null, submittedAt: new Date().toISOString() },
    });
  }, []);

  const closePosition = useCallback((id: string) => {
    dispatch({ type: 'position/delete', id });
  }, []);

  const updateRiskRule = useCallback((rule: RiskRule) => {
    dispatch({ type: 'risk/update', rule });
  }, []);

  const setKillSwitch = useCallback(
    (active: boolean) => {
      dispatch({ type: 'risk/killSwitch', active });
      notify({
        type: 'risque',
        title: active ? 'Coupe-circuit activé' : 'Coupe-circuit désactivé',
        message: active
          ? 'Toutes les exécutions sont suspendues jusqu’à réarmement.'
          : 'Les exécutions reprennent normalement.',
        severity: active ? 'error' : 'success',
      });
    },
    [notify]
  );

  const setLiveFeed = useCallback((active: boolean) => {
    dispatch({ type: 'feed/toggle', active });
  }, []);

  const ingestSignal = useCallback(
    (signal: IncomingSignal) => {
      const current = stateRef.current;
      if (current.processedSignalIds.includes(signal.signalId)) return;

      const strategy = current.strategies.find((s) => s.webhookId === signal.webhookId);
      const now = new Date().toISOString();

      if (!strategy) {
        dispatch({
          type: 'signal/log',
          signalId: signal.signalId,
          orders: [],
          log: {
            id: uid('sig'),
            signalId: signal.signalId,
            ticker: signal.ticker,
            action: signal.action,
            strategyName: '—',
            source: signal.source,
            status: 'rejete',
            reason: 'Aucune stratégie ne correspond à ce webhook.',
            subscriptionsTargeted: 0,
            receivedAt: now,
          },
        });
        return;
      }

      const duplicate =
        strategy.rejectDuplicates &&
        current.signalLogs.some(
          (l) => l.signalId === signal.signalId && l.strategyName === strategy.name
        );

      const subs = current.subscriptions.filter((s) => s.strategyId === strategy.id);

      if (duplicate) {
        dispatch({
          type: 'signal/log',
          signalId: signal.signalId,
          orders: [],
          log: {
            id: uid('sig'),
            signalId: signal.signalId,
            ticker: signal.ticker,
            action: signal.action,
            strategyName: strategy.name,
            source: signal.source,
            status: 'duplique',
            reason: 'Signal déjà traité (déduplication active).',
            subscriptionsTargeted: subs.length,
            receivedAt: now,
          },
        });
        return;
      }

      const createdOrders: Order[] = [];
      const rejections: string[] = [];

      subs.forEach((sub) => {
        const connection = current.connections.find((c) => c.id === sub.connectionId);
        if (!connection) return;
        const price = signal.price ?? 100;
        const quantity = sizeOrder(sub, connection, price, signal.quantity);
        const decision = evaluateRisk(current, strategy, sub, signal, quantity, price);

        if (!decision.allowed) {
          if (decision.reason) rejections.push(decision.reason);
          return;
        }

        const status: OrderStatus =
          sub.executionMode === 'validation_manuelle'
            ? 'en_attente_validation'
            : sub.executionMode === 'simulation'
            ? 'valide'
            : 'soumis';

        createdOrders.push({
          id: uid('ord'),
          signalId: signal.signalId,
          ticker: sub.tickerOverride ?? signal.ticker,
          action: signal.action,
          side: actionToSide[signal.action],
          quantity,
          orderType: signal.orderType ?? strategy.defaultOrderType,
          limitPrice: (signal.orderType ?? strategy.defaultOrderType) === 'limit' ? price : null,
          stopPrice: (signal.orderType ?? strategy.defaultOrderType) === 'stop' ? price : null,
          timeInForce: 'day',
          status,
          strategyId: strategy.id,
          strategyName: strategy.name,
          connectionId: connection.id,
          connectionName: connection.name,
          brokerOrderId: status === 'soumis' ? uid('brk').toUpperCase() : null,
          filledQty: 0,
          avgFillPrice: null,
          rejectionReason: null,
          receivedAt: now,
          submittedAt: status === 'soumis' ? now : null,
          executedAt: null,
        });
      });

      const accepted = createdOrders.length > 0;

      dispatch({
        type: 'signal/log',
        signalId: signal.signalId,
        orders: createdOrders,
        log: {
          id: uid('sig'),
          signalId: signal.signalId,
          ticker: signal.ticker,
          action: signal.action,
          strategyName: strategy.name,
          source: signal.source,
          status: accepted ? 'accepte' : 'rejete',
          reason: accepted ? null : rejections[0] ?? 'Aucun abonnement éligible.',
          subscriptionsTargeted: subs.length,
          receivedAt: now,
        },
      });

      dispatch({
        type: 'strategy/upsert',
        strategy: { ...strategy, signalsToday: strategy.signalsToday + 1 },
      });

      notify({
        type: 'signal',
        title: accepted ? `Signal accepté — ${signal.ticker}` : `Signal rejeté — ${signal.ticker}`,
        message: accepted
          ? `${createdOrders.length} ordre(s) créé(s) via ${strategy.name}.`
          : rejections[0] ?? 'Aucun abonnement éligible.',
        severity: accepted ? 'success' : 'warning',
      });
    },
    [notify]
  );

  const simulateSignal = useCallback(() => {
    const current = stateRef.current;
    const active = current.strategies.filter((s) => s.status === 'active');
    if (active.length === 0) return;
    const strategy = active[Math.floor(Math.random() * active.length)];
    const pool = strategy.whitelist.length > 0 ? strategy.whitelist : ['AAPL'];
    const ticker = pool[Math.floor(Math.random() * pool.length)];
    const action = strategy.allowedActions[
      Math.floor(Math.random() * strategy.allowedActions.length)
    ];
    ingestSignal({
      signalId: uid('sig-live'),
      ticker,
      action,
      price: Number((50 + Math.random() * 250).toFixed(2)),
      source: 'Simulateur interne',
      receivedAt: new Date().toISOString(),
      webhookId: strategy.webhookId,
    });
  }, [ingestSignal]);

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'notification/read', id });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    dispatch({ type: 'notification/readAll' });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'notification/clear' });
  }, []);

  const resetDemoData = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  // Order lifecycle: submitted orders reach the broker and fill.
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      const pending = current.orders.filter(
        (o) => o.status === 'soumis' || o.status === 'envoi_en_cours'
      );
      pending.slice(0, 3).forEach((order) => {
        const now = new Date().toISOString();
        if (order.status === 'envoi_en_cours') {
          dispatch({
            type: 'order/status',
            id: order.id,
            status: 'soumis',
            patch: { brokerOrderId: order.brokerOrderId ?? uid('brk').toUpperCase() },
          });
          return;
        }
        const price = order.limitPrice ?? order.stopPrice ?? 100;
        const fillPrice = Number((price * (1 + (Math.random() - 0.5) * 0.002)).toFixed(2));
        dispatch({
          type: 'order/status',
          id: order.id,
          status: 'execute',
          patch: {
            filledQty: order.quantity,
            avgFillPrice: fillPrice,
            executedAt: now,
          },
        });

        const existing = current.positions.find(
          (p) => p.ticker === order.ticker && p.connectionName === order.connectionName
        );
        const direction = order.side === 'achat' ? 1 : -1;
        if (existing) {
          const netQty = existing.qty * (existing.side === 'short' ? -1 : 1) + direction * order.quantity;
          if (netQty === 0) {
            dispatch({ type: 'position/delete', id: existing.id });
          } else {
            const qty = Math.abs(netQty);
            const avgPrice =
              Math.sign(netQty) === direction
                ? (existing.avgPrice * existing.qty + fillPrice * order.quantity) /
                  (existing.qty + order.quantity)
                : existing.avgPrice;
            const side: Position['side'] = netQty > 0 ? 'long' : 'short';
            const pnl = (side === 'short' ? avgPrice - fillPrice : fillPrice - avgPrice) * qty;
            dispatch({
              type: 'position/upsert',
              position: {
                ...existing,
                qty,
                side,
                avgPrice: Number(avgPrice.toFixed(2)),
                currentPrice: fillPrice,
                marketValue: Number((qty * fillPrice).toFixed(2)),
                pnl: Number(pnl.toFixed(2)),
                pnlPercent: Number(((pnl / (avgPrice * qty)) * 100).toFixed(2)),
              },
            });
          }
        } else {
          dispatch({
            type: 'position/upsert',
            position: {
              id: uid('pos'),
              ticker: order.ticker,
              connectionName: order.connectionName,
              qty: order.quantity,
              side: order.side === 'achat' ? 'long' : 'short',
              avgPrice: fillPrice,
              currentPrice: fillPrice,
              marketValue: Number((order.quantity * fillPrice).toFixed(2)),
              pnl: 0,
              pnlPercent: 0,
            },
          });
        }
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  // Live market simulation: drifts open position prices.
  useEffect(() => {
    if (!hydrated || !state.liveFeed) return;
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      const prices: Record<string, number> = {};
      current.positions.forEach((p) => {
        prices[p.ticker] = Number(
          (p.currentPrice * (1 + (Math.random() - 0.5) * 0.004)).toFixed(2)
        );
      });
      if (Object.keys(prices).length > 0) dispatch({ type: 'position/prices', prices });
      if (Math.random() < 0.3) simulateSignal();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hydrated, state.liveFeed, simulateSignal]);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      hydrated,
      createStrategy,
      updateStrategy,
      deleteStrategy,
      regenerateSecret,
      createConnection,
      updateConnection,
      deleteConnection,
      testConnection,
      setConnectionEnabled,
      createSubscription,
      saveSubscription,
      deleteSubscription,
      cancelOrder,
      approveOrder,
      rejectOrder,
      retryOrder,
      closePosition,
      updateRiskRule,
      setKillSwitch,
      setLiveFeed,
      ingestSignal,
      simulateSignal,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      notify,
      resetDemoData,
    }),
    [
      state,
      hydrated,
      createStrategy,
      updateStrategy,
      deleteStrategy,
      regenerateSecret,
      createConnection,
      updateConnection,
      deleteConnection,
      testConnection,
      setConnectionEnabled,
      createSubscription,
      saveSubscription,
      deleteSubscription,
      cancelOrder,
      approveOrder,
      rejectOrder,
      retryOrder,
      closePosition,
      updateRiskRule,
      setKillSwitch,
      setLiveFeed,
      ingestSignal,
      simulateSignal,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      notify,
      resetDemoData,
    ]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé dans un StoreProvider.');
  return ctx;
}
