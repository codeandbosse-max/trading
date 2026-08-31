import type {
  AuditLog,
  Connection,
  NotificationItem,
  Order,
  Position,
  RiskRule,
  SignalLog,
  Strategy,
  Subscription,
} from '@trading/shared';
import { getDb } from '../db/pool';

type Row = Record<string, any>;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return iso(value);
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return num(value);
}

export function mapStrategy(row: Row, subscriptionsCount = 0): Strategy {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    assetClass: row.asset_class,
    allowedActions: list(row.allowed_actions) as Strategy['allowedActions'],
    whitelist: list(row.whitelist),
    blacklist: list(row.blacklist),
    webhookId: row.webhook_id,
    webhookSecret: row.webhook_secret,
    maxSignalDelaySec: num(row.max_signal_delay_sec),
    rejectDuplicates: Boolean(row.reject_duplicates),
    maxVolume: num(row.max_volume),
    maxExposure: num(row.max_exposure),
    defaultOrderType: row.default_order_type,
    subscriptionsCount,
    signalsToday: num(row.signals_today),
    createdAt: iso(row.created_at),
  };
}

export function mapConnection(row: Row): Connection {
  return {
    id: row.id,
    name: row.name,
    broker: row.broker,
    env: row.env,
    status: row.status,
    currency: row.currency,
    buyingPower: num(row.buying_power),
    equity: num(row.equity),
    positionsCount: num(row.positions_count ?? 0),
    lastTestAt: iso(row.last_test_at),
    allowedInstruments: list(row.allowed_instruments),
  };
}

export function mapSubscription(row: Row): Subscription {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    connectionId: row.connection_id,
    enabled: Boolean(row.enabled),
    executionMode: row.execution_mode,
    sizingMethod: row.sizing_method,
    sizingValue: num(row.sizing_value),
    maxOrderSize: num(row.max_order_size),
    maxExposure: num(row.max_exposure),
    allowShort: Boolean(row.allow_short),
    tickerOverride: row.ticker_override ?? null,
  };
}

export function mapOrder(row: Row): Order {
  return {
    id: row.id,
    signalId: row.signal_id,
    ticker: row.ticker,
    action: row.action,
    side: row.side,
    quantity: num(row.quantity),
    orderType: row.order_type,
    limitPrice: numOrNull(row.limit_price),
    stopPrice: numOrNull(row.stop_price),
    timeInForce: row.time_in_force,
    status: row.status,
    strategyId: row.strategy_id ?? '',
    strategyName: row.strategy_name,
    connectionId: row.connection_id ?? '',
    connectionName: row.connection_name,
    brokerOrderId: row.broker_order_id ?? null,
    filledQty: num(row.filled_qty),
    avgFillPrice: numOrNull(row.avg_fill_price),
    rejectionReason: row.rejection_reason ?? null,
    receivedAt: iso(row.received_at),
    submittedAt: isoOrNull(row.submitted_at),
    executedAt: isoOrNull(row.executed_at),
    executionVenue: row.execution_venue ?? 'simulation',
  };
}

export function mapSignalLog(row: Row): SignalLog {
  return {
    id: row.id,
    signalId: row.signal_id,
    ticker: row.ticker,
    action: row.action,
    strategyName: row.strategy_name,
    source: row.source,
    status: row.status,
    reason: row.reason ?? null,
    subscriptionsTargeted: num(row.subscriptions_targeted),
    receivedAt: iso(row.received_at),
  };
}

export function mapPosition(row: Row): Position {
  return {
    id: row.id,
    ticker: row.ticker,
    connectionName: row.connection_name,
    qty: num(row.qty),
    side: row.side,
    avgPrice: num(row.avg_price),
    currentPrice: num(row.current_price),
    marketValue: num(row.market_value),
    pnl: num(row.pnl),
    pnlPercent: num(row.pnl_percent),
  };
}

export function mapRiskRule(row: Row): RiskRule {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    value: row.value,
    enabled: Boolean(row.enabled),
    triggered: Boolean(row.triggered),
  };
}

export function mapAuditLog(row: Row): AuditLog {
  return {
    id: row.id,
    timestamp: iso(row.timestamp),
    actor: row.actor,
    action: row.action,
    target: row.target,
    ip: row.ip,
    severity: row.severity,
  };
}

export function mapNotification(row: Row): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    timestamp: iso(row.timestamp),
    read: Boolean(row.read),
  };
}

export async function listStrategies(): Promise<Strategy[]> {
  const db = getDb();
  const [{ rows }, counts] = await Promise.all([
    db.query(`SELECT * FROM strategies ORDER BY created_at DESC`),
    db.query(`SELECT strategy_id, COUNT(*) AS total FROM subscriptions GROUP BY strategy_id`),
  ]);
  const byStrategy = new Map<string, number>(
    counts.rows.map((r) => [String(r.strategy_id), num(r.total)])
  );
  return rows.map((r) => mapStrategy(r, byStrategy.get(String(r.id)) ?? 0));
}

export async function findStrategyByWebhookId(webhookId: string): Promise<Strategy | null> {
  const { rows } = await getDb().query(`SELECT * FROM strategies WHERE webhook_id = $1`, [
    webhookId,
  ]);
  return rows[0] ? mapStrategy(rows[0]) : null;
}

export async function findStrategy(id: string): Promise<Strategy | null> {
  const { rows } = await getDb().query(`SELECT * FROM strategies WHERE id = $1`, [id]);
  return rows[0] ? mapStrategy(rows[0]) : null;
}

export async function listConnections(): Promise<Connection[]> {
  const db = getDb();
  const [{ rows }, counts] = await Promise.all([
    db.query(`SELECT * FROM connections ORDER BY name`),
    db.query(`SELECT connection_name, COUNT(*) AS total FROM positions GROUP BY connection_name`),
  ]);
  const byName = new Map<string, number>(
    counts.rows.map((r) => [String(r.connection_name), num(r.total)])
  );
  return rows.map((r) => ({
    ...mapConnection(r),
    positionsCount: byName.get(String(r.name)) ?? 0,
  }));
}

export async function findConnection(id: string): Promise<Connection | null> {
  const { rows } = await getDb().query(`SELECT * FROM connections WHERE id = $1`, [id]);
  return rows[0] ? mapConnection(rows[0]) : null;
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const { rows } = await getDb().query(`SELECT * FROM subscriptions`);
  return rows.map(mapSubscription);
}

export async function listSubscriptionsForStrategy(strategyId: string): Promise<Subscription[]> {
  const { rows } = await getDb().query(`SELECT * FROM subscriptions WHERE strategy_id = $1`, [
    strategyId,
  ]);
  return rows.map(mapSubscription);
}

export async function listOrders(limit = 200, offset = 0): Promise<Order[]> {
  const { rows } = await getDb().query(
    `SELECT * FROM orders ORDER BY received_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(mapOrder);
}

export async function countRows(table: string): Promise<number> {
  const allowed = ['orders', 'signal_logs', 'audit_logs', 'notifications'];
  if (!allowed.includes(table)) throw new Error(`Table non autorisée : ${table}`);
  const { rows } = await getDb().query(`SELECT COUNT(*) AS total FROM ${table}`);
  return num(rows[0]?.total);
}

export async function findOrder(id: string): Promise<Order | null> {
  const { rows } = await getDb().query(`SELECT * FROM orders WHERE id = $1`, [id]);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function listSignalLogs(limit = 200, offset = 0): Promise<SignalLog[]> {
  const { rows } = await getDb().query(
    `SELECT * FROM signal_logs ORDER BY received_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(mapSignalLog);
}

export async function listPositions(): Promise<Position[]> {
  const { rows } = await getDb().query(`SELECT * FROM positions ORDER BY ticker`);
  return rows.map(mapPosition);
}

export async function listRiskRules(): Promise<RiskRule[]> {
  const { rows } = await getDb().query(`SELECT * FROM risk_rules ORDER BY position, id`);
  return rows.map(mapRiskRule);
}

export async function listAuditLogs(limit = 300, offset = 0): Promise<AuditLog[]> {
  const { rows } = await getDb().query(
    `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(mapAuditLog);
}

export async function listNotifications(limit = 100): Promise<NotificationItem[]> {
  const { rows } = await getDb().query(
    `SELECT * FROM notifications ORDER BY timestamp DESC LIMIT $1`,
    [limit]
  );
  return rows.map(mapNotification);
}

export async function getKillSwitch(): Promise<boolean> {
  const { rows } = await getDb().query(`SELECT value FROM settings WHERE key = 'kill_switch'`);
  return rows[0]?.value === 'true';
}

export async function setKillSwitch(active: boolean): Promise<void> {
  await getDb().query(
    `INSERT INTO settings (key, value) VALUES ('kill_switch', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [active ? 'true' : 'false']
  );
}

export async function findConnectionCredentials(
  id: string
): Promise<{ apiKeyCipher: string | null; apiSecretCipher: string | null }> {
  const { rows } = await getDb().query(
    `SELECT api_key_cipher, api_secret_cipher FROM connections WHERE id = $1`,
    [id]
  );
  return {
    apiKeyCipher: rows[0]?.api_key_cipher ?? null,
    apiSecretCipher: rows[0]?.api_secret_cipher ?? null,
  };
}

export async function countOrdersSince(since: Date): Promise<number> {
  const { rows } = await getDb().query(
    `SELECT COUNT(*) AS total FROM orders WHERE received_at >= $1`,
    [since.toISOString()]
  );
  return num(rows[0]?.total);
}

export async function realizedPnlSince(since: Date): Promise<number> {
  const { rows } = await getDb().query(
    `SELECT COALESCE(SUM(pnl), 0) AS total FROM realized_trades WHERE closed_at >= $1`,
    [since.toISOString()]
  );
  return num(rows[0]?.total);
}

/** Counts losing trades from the most recent one backwards. */
export async function countConsecutiveLosses(lookback = 50): Promise<number> {
  const { rows } = await getDb().query(
    `SELECT pnl FROM realized_trades ORDER BY closed_at DESC LIMIT $1`,
    [lookback]
  );
  let streak = 0;
  for (const row of rows) {
    if (num(row.pnl) < 0) streak += 1;
    else break;
  }
  return streak;
}

export async function recordRealizedTrade(input: {
  id: string;
  ticker: string;
  connectionName: string;
  quantity: number;
  pnl: number;
}): Promise<void> {
  await getDb().query(
    `INSERT INTO realized_trades (id, ticker, connection_name, quantity, pnl, closed_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [input.id, input.ticker, input.connectionName, input.quantity, input.pnl]
  );
}
