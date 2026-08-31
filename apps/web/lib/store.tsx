'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AppState,
  ConnectionFormOutput,
  RiskRule,
  StrategyPayload,
  SubscriptionPayload,
} from '@trading/shared';
import { api } from '@/lib/api';
import { signPayload } from '@/lib/hmac';

const EMPTY_STATE: AppState = {
  strategies: [],
  connections: [],
  subscriptions: [],
  orders: [],
  signalLogs: [],
  positions: [],
  riskRules: [],
  auditLogs: [],
  notifications: [],
  killSwitch: false,
};

interface StoreApi {
  state: AppState;
  hydrated: boolean;
  offline: boolean;
  liveFeed: boolean;
  refresh: () => Promise<void>;
  createStrategy: (input: StrategyPayload) => Promise<void>;
  updateStrategy: (id: string, input: StrategyPayload) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  regenerateSecret: (id: string) => Promise<void>;
  createConnection: (input: ConnectionFormOutput) => Promise<void>;
  updateConnection: (
    id: string,
    input: Omit<ConnectionFormOutput, 'apiKey' | 'apiSecret'>
  ) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<boolean>;
  setConnectionEnabled: (id: string, enabled: boolean) => Promise<void>;
  createSubscription: (input: SubscriptionPayload) => Promise<void>;
  updateSubscription: (id: string, input: SubscriptionPayload) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  approveOrder: (id: string) => Promise<void>;
  rejectOrder: (id: string, reason: string) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
  retryOrder: (id: string) => Promise<void>;
  closePosition: (id: string) => Promise<void>;
  updateRiskRule: (rule: RiskRule) => Promise<void>;
  setKillSwitch: (active: boolean) => Promise<void>;
  setLiveFeed: (active: boolean) => void;
  simulateSignal: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [offline, setOffline] = useState(false);
  const [liveFeed, setLiveFeed] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    try {
      const next = await api.getState();
      setState(next);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The API workers fill orders and reprice positions; poll to stay in sync.
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), liveFeed ? 3000 : 8000);
    return () => window.clearInterval(timer);
  }, [refresh, liveFeed]);

  const run = useCallback(
    async (operation: () => Promise<unknown>) => {
      await operation();
      await refresh();
    },
    [refresh]
  );

  const simulateSignal = useCallback(async () => {
    const active = stateRef.current.strategies.filter((s) => s.status === 'active');
    if (active.length === 0) throw new Error('Aucune stratégie active.');
    const strategy = active[Math.floor(Math.random() * active.length)];
    const pool = strategy.whitelist.length > 0 ? strategy.whitelist : ['AAPL'];
    const body = JSON.stringify({
      signalId: `sim-${Date.now().toString(36)}`,
      ticker: pool[Math.floor(Math.random() * pool.length)],
      action: strategy.allowedActions[Math.floor(Math.random() * strategy.allowedActions.length)],
      price: Number((50 + Math.random() * 250).toFixed(2)),
      source: 'Simulateur interne',
    });
    const signature = await signPayload(strategy.webhookSecret, body);
    const res = await api.sendSignal(strategy.webhookId, signature, body);
    if (!res.ok) throw new Error('Le signal de test a été refusé.');
    await refresh();
  }, [refresh]);

  const value = useMemo<StoreApi>(
    () => ({
      state,
      hydrated,
      offline,
      liveFeed,
      refresh,
      createStrategy: (input) => run(() => api.createStrategy(input)),
      updateStrategy: (id, input) => run(() => api.updateStrategy(id, input)),
      deleteStrategy: (id) => run(() => api.deleteStrategy(id)),
      regenerateSecret: (id) => run(() => api.rotateSecret(id)),
      createConnection: (input) => run(() => api.createConnection(input)),
      updateConnection: (id, input) => run(() => api.updateConnection(id, input)),
      deleteConnection: (id) => run(() => api.deleteConnection(id)),
      testConnection: async (id) => {
        const result = await api.testConnection(id);
        await refresh();
        return result.reachable;
      },
      setConnectionEnabled: (id, enabled) => run(() => api.setConnectionEnabled(id, enabled)),
      createSubscription: (input) => run(() => api.createSubscription(input)),
      updateSubscription: (id, input) => run(() => api.updateSubscription(id, input)),
      deleteSubscription: (id) => run(() => api.deleteSubscription(id)),
      approveOrder: (id) => run(() => api.orderAction(id, 'approve')),
      rejectOrder: (id, reason) => run(() => api.orderAction(id, 'reject', reason)),
      cancelOrder: (id) => run(() => api.orderAction(id, 'cancel')),
      retryOrder: (id) => run(() => api.orderAction(id, 'retry')),
      closePosition: (id) => run(() => api.closePosition(id)),
      updateRiskRule: (rule) => run(() => api.updateRiskRule(rule.id, rule.value, rule.enabled)),
      setKillSwitch: (active) => run(() => api.setKillSwitch(active)),
      setLiveFeed,
      simulateSignal,
      markNotificationRead: (id) => run(() => api.markNotificationRead(id)),
      markAllNotificationsRead: () => run(() => api.markAllNotificationsRead()),
    }),
    [state, hydrated, offline, liveFeed, refresh, run, simulateSignal]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé dans un StoreProvider.');
  return ctx;
}
