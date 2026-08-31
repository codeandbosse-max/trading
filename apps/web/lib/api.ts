import type {
  AppState,
  AuditLog,
  Connection,
  ConnectionFormOutput,
  LoginPayload,
  Order,
  Page,
  RegisterPayload,
  RiskRule,
  SignalLog,
  Strategy,
  StrategyPayload,
  Subscription,
  SubscriptionPayload,
  User,
} from '@trading/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    // The session lives in an httpOnly cookie set by the API.
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, payload?.error ?? 'Erreur inattendue.', payload?.details);
  }
  return payload as T;
}

export const api = {
  getState: () => request<AppState>('/api/state'),

  authStatus: () =>
    request<{ bootstrap: boolean; signupCodeRequired: boolean }>('/api/auth/status'),
  me: () => request<User>('/api/auth/me'),
  register: (input: RegisterPayload) =>
    request<User>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: LoginPayload) =>
    request<User>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  getOrders: (limit: number) => request<Page<Order>>(`/api/orders?limit=${limit}`),
  getSignalLogs: (limit: number) => request<Page<SignalLog>>(`/api/signal-logs?limit=${limit}`),
  getAuditLogs: (limit: number) => request<Page<AuditLog>>(`/api/audit-logs?limit=${limit}`),

  createStrategy: (input: StrategyPayload) =>
    request<Strategy>('/api/strategies', { method: 'POST', body: JSON.stringify(input) }),
  updateStrategy: (id: string, input: StrategyPayload) =>
    request<Strategy>(`/api/strategies/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteStrategy: (id: string) => request<void>(`/api/strategies/${id}`, { method: 'DELETE' }),
  rotateSecret: (id: string) =>
    request<Strategy>(`/api/strategies/${id}/rotate-secret`, { method: 'POST' }),

  createConnection: (input: ConnectionFormOutput) =>
    request<Connection>('/api/connections', { method: 'POST', body: JSON.stringify(input) }),
  updateConnection: (id: string, input: Omit<ConnectionFormOutput, 'apiKey' | 'apiSecret'>) =>
    request<Connection>(`/api/connections/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteConnection: (id: string) => request<void>(`/api/connections/${id}`, { method: 'DELETE' }),
  testConnection: (id: string) =>
    request<{ reachable: boolean; connection: Connection }>(`/api/connections/${id}/test`, {
      method: 'POST',
    }),
  setConnectionEnabled: (id: string, enabled: boolean) =>
    request<Connection>(`/api/connections/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  createSubscription: (input: SubscriptionPayload) =>
    request<Subscription>('/api/subscriptions', { method: 'POST', body: JSON.stringify(input) }),
  updateSubscription: (id: string, input: SubscriptionPayload) =>
    request<Subscription>(`/api/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteSubscription: (id: string) =>
    request<void>(`/api/subscriptions/${id}`, { method: 'DELETE' }),

  orderAction: (id: string, action: 'approve' | 'reject' | 'cancel' | 'retry', reason?: string) =>
    request<{ id: string; status: string }>(`/api/orders/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }),

  closePosition: (id: string) => request<void>(`/api/positions/${id}`, { method: 'DELETE' }),

  updateRiskRule: (id: string, value: string, enabled: boolean) =>
    request<RiskRule>(`/api/risk/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ value, enabled }),
    }),
  setKillSwitch: (active: boolean) =>
    request<{ active: boolean }>('/api/risk/kill-switch', {
      method: 'POST',
      body: JSON.stringify({ active }),
    }),

  markNotificationRead: (id: string) =>
    request<void>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<void>('/api/notifications/read-all', { method: 'POST' }),

  sendSignal: (webhookId: string, signature: string, body: string) =>
    fetch(`${API_URL}/api/webhook/${webhookId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': signature },
      body,
    }),
};