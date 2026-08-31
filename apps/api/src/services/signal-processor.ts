import {
  actionToSide,
  evaluateRisk,
  sizeOrder,
  type IncomingSignal,
  type Order,
  type OrderStatus,
  type RiskContext,
  type SignalLog,
  type SignalResult,
} from '@trading/shared';
import { getDb } from '../db/pool';
import { uid } from '../lib/crypto';
import { config } from '../config';
import {
  countConsecutiveLosses,
  countOrdersSince,
  findStrategyByWebhookId,
  getKillSwitch,
  listConnections,
  listPositions,
  listRiskRules,
  listSubscriptionsForStrategy,
  mapOrder,
  mapSignalLog,
  realizedPnlSince,
} from '../repositories/queries';
import { pushNotification } from './journal';

async function insertSignalLog(input: Omit<SignalLog, 'id'>): Promise<SignalLog> {
  const { rows } = await getDb().query(
    `INSERT INTO signal_logs
       (id, signal_id, ticker, action, strategy_name, source, status, reason, subscriptions_targeted, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      uid('sig'),
      input.signalId,
      input.ticker,
      input.action,
      input.strategyName,
      input.source,
      input.status,
      input.reason,
      input.subscriptionsTargeted,
      input.receivedAt,
    ]
  );
  return mapSignalLog(rows[0]);
}

async function insertOrder(order: Omit<Order, 'id'>): Promise<Order> {
  const { rows } = await getDb().query(
    `INSERT INTO orders
       (id, signal_id, ticker, action, side, quantity, order_type, limit_price, stop_price,
        time_in_force, status, strategy_id, strategy_name, connection_id, connection_name,
        broker_order_id, filled_qty, avg_fill_price, rejection_reason, received_at, submitted_at,
        executed_at, execution_venue)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     RETURNING *`,
    [
      uid('ord'),
      order.signalId,
      order.ticker,
      order.action,
      order.side,
      order.quantity,
      order.orderType,
      order.limitPrice,
      order.stopPrice,
      order.timeInForce,
      order.status,
      order.strategyId,
      order.strategyName,
      order.connectionId,
      order.connectionName,
      order.brokerOrderId,
      order.filledQty,
      order.avgFillPrice,
      order.rejectionReason,
      order.receivedAt,
      order.submittedAt,
      order.executedAt,
      order.executionVenue,
    ]
  );
  return mapOrder(rows[0]);
}

/**
 * Applies strategy rules, risk limits and sizing to an incoming signal,
 * then persists the resulting log and orders.
 */
export async function processSignal(signal: IncomingSignal): Promise<SignalResult> {
  const now = new Date().toISOString();
  const strategy = await findStrategyByWebhookId(signal.webhookId);

  if (!strategy) {
    const log = await insertSignalLog({
      signalId: signal.signalId,
      ticker: signal.ticker,
      action: signal.action,
      strategyName: '—',
      source: signal.source,
      status: 'rejete',
      reason: 'Aucune stratégie ne correspond à ce webhook.',
      subscriptionsTargeted: 0,
      receivedAt: now,
    });
    return { log, orders: [] };
  }

  const subscriptions = await listSubscriptionsForStrategy(strategy.id);

  if (strategy.rejectDuplicates) {
    const { rowCount } = await getDb().query(
      `INSERT INTO processed_signals (signal_id, strategy_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [signal.signalId, strategy.id]
    );
    if (rowCount === 0) {
      const log = await insertSignalLog({
        signalId: signal.signalId,
        ticker: signal.ticker,
        action: signal.action,
        strategyName: strategy.name,
        source: signal.source,
        status: 'duplique',
        reason: 'Signal déjà traité (déduplication active).',
        subscriptionsTargeted: subscriptions.length,
        receivedAt: now,
      });
      return { log, orders: [] };
    }
  }

  const [killSwitch, riskRules, connections, positions] = await Promise.all([
    getKillSwitch(),
    listRiskRules(),
    listConnections(),
    listPositions(),
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [ordersToday, realizedPnlToday, consecutiveLosses] = await Promise.all([
    countOrdersSince(startOfDay),
    realizedPnlSince(startOfDay),
    countConsecutiveLosses(),
  ]);

  const ctx: RiskContext = {
    killSwitch,
    riskRules,
    connections,
    positions,
    ordersToday,
    realizedPnlToday,
    consecutiveLosses,
    now: new Date(),
    timeZone: config.riskTimeZone,
  };

  const created: Order[] = [];
  const rejections: string[] = [];

  for (const sub of subscriptions) {
    const connection = connections.find((c) => c.id === sub.connectionId);
    if (!connection) continue;

    const price = signal.price ?? 100;
    const quantity = sizeOrder(sub, connection, price, signal.quantity);
    const decision = evaluateRisk(ctx, strategy, sub, signal, quantity, price);

    if (!decision.allowed) {
      if (decision.reason) rejections.push(decision.reason);
      continue;
    }

    const status: OrderStatus =
      sub.executionMode === 'validation_manuelle' || decision.requireManualValidation
        ? 'en_attente_validation'
        : sub.executionMode === 'simulation'
        ? 'valide'
        : 'soumis';

    const orderType = signal.orderType ?? strategy.defaultOrderType;

    created.push(
      await insertOrder({
        signalId: signal.signalId,
        ticker: sub.tickerOverride ?? signal.ticker,
        action: signal.action,
        side: actionToSide[signal.action],
        quantity,
        orderType,
        limitPrice: orderType === 'limit' ? price : null,
        stopPrice: orderType === 'stop' ? price : signal.stopLoss ?? null,
        timeInForce: 'day',
        status,
        strategyId: strategy.id,
        strategyName: strategy.name,
        connectionId: connection.id,
        connectionName: connection.name,
        brokerOrderId: null,
        filledQty: 0,
        avgFillPrice: null,
        rejectionReason: null,
        receivedAt: now,
        submittedAt: null,
        executedAt: null,
        executionVenue: 'simulation',
      })
    );
  }

  const accepted = created.length > 0;

  const log = await insertSignalLog({
    signalId: signal.signalId,
    ticker: signal.ticker,
    action: signal.action,
    strategyName: strategy.name,
    source: signal.source,
    status: accepted ? 'accepte' : 'rejete',
    reason: accepted ? null : rejections[0] ?? 'Aucun abonnement éligible.',
    subscriptionsTargeted: subscriptions.length,
    receivedAt: now,
  });

  await getDb().query(`UPDATE strategies SET signals_today = signals_today + 1 WHERE id = $1`, [
    strategy.id,
  ]);

  await pushNotification({
    type: 'signal',
    title: accepted ? `Signal accepté — ${signal.ticker}` : `Signal rejeté — ${signal.ticker}`,
    message: accepted
      ? `${created.length} ordre(s) créé(s) via ${strategy.name}.`
      : rejections[0] ?? 'Aucun abonnement éligible.',
    severity: accepted ? 'success' : 'warning',
  });

  return { log, orders: created };
}
