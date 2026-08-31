import type { Connection, Order, Position } from '@trading/shared';
import { getDb } from '../db/pool';
import { decrypt, uid } from '../lib/crypto';
import {
  findConnection,
  findConnectionCredentials,
  mapOrder,
  mapPosition,
  recordRealizedTrade,
} from '../repositories/queries';
import { resolveAdapter, BrokerError, type BrokerCredentials } from '../brokers';
import { pushNotification } from './journal';

async function loadCredentials(connectionId: string): Promise<BrokerCredentials | null> {
  const { apiKeyCipher, apiSecretCipher } = await findConnectionCredentials(connectionId);
  if (!apiKeyCipher || !apiSecretCipher) return null;
  try {
    return { apiKey: decrypt(apiKeyCipher), apiSecret: decrypt(apiSecretCipher) };
  } catch {
    // Wrong ENCRYPTION_KEY: treat as missing credentials rather than crashing the tick.
    return null;
  }
}

/** Applies a fill to the position book and records realised P&L when it reduces or closes. */
async function applyFill(order: Order, fillPrice: number, filledQty: number): Promise<void> {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM positions WHERE ticker = $1 AND connection_name = $2`,
    [order.ticker, order.connectionName]
  );
  const existing: Position | undefined = rows[0] ? mapPosition(rows[0]) : undefined;
  const direction = order.side === 'achat' ? 1 : -1;

  if (!existing) {
    await db.query(
      `INSERT INTO positions
         (id, ticker, connection_name, qty, side, avg_price, current_price, market_value, pnl, pnl_percent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0)`,
      [
        uid('pos'),
        order.ticker,
        order.connectionName,
        filledQty,
        direction === 1 ? 'long' : 'short',
        fillPrice,
        fillPrice,
        Number((filledQty * fillPrice).toFixed(2)),
      ]
    );
    return;
  }

  const signedExisting = existing.qty * (existing.side === 'short' ? -1 : 1);
  const net = signedExisting + direction * filledQty;
  const reducing = Math.sign(direction) !== Math.sign(signedExisting);

  if (reducing) {
    const closedQty = Math.min(filledQty, Math.abs(signedExisting));
    const pnl =
      existing.side === 'short'
        ? (existing.avgPrice - fillPrice) * closedQty
        : (fillPrice - existing.avgPrice) * closedQty;
    await recordRealizedTrade({
      id: uid('trade'),
      ticker: order.ticker,
      connectionName: order.connectionName,
      quantity: closedQty,
      pnl: Number(pnl.toFixed(2)),
    });
  }

  if (net === 0) {
    await db.query(`DELETE FROM positions WHERE id = $1`, [existing.id]);
    return;
  }

  const qty = Math.abs(net);
  const avgPrice = reducing
    ? existing.avgPrice
    : (existing.avgPrice * existing.qty + fillPrice * filledQty) / (existing.qty + filledQty);
  const side = net > 0 ? 'long' : 'short';
  const pnl = (side === 'short' ? avgPrice - fillPrice : fillPrice - avgPrice) * qty;

  await db.query(
    `UPDATE positions
       SET qty = $1, side = $2, avg_price = $3, current_price = $4,
           market_value = $5, pnl = $6, pnl_percent = $7
     WHERE id = $8`,
    [
      qty,
      side,
      Number(avgPrice.toFixed(4)),
      fillPrice,
      Number((qty * fillPrice).toFixed(2)),
      Number(pnl.toFixed(2)),
      avgPrice === 0 ? 0 : Number(((pnl / (avgPrice * qty)) * 100).toFixed(2)),
      existing.id,
    ]
  );
}

async function failOrder(order: Order, message: string): Promise<void> {
  await getDb().query(
    `UPDATE orders SET status = 'erreur', rejection_reason = $2 WHERE id = $1`,
    [order.id, message]
  );
  await pushNotification({
    type: 'ordre',
    title: `Ordre en erreur — ${order.ticker}`,
    message,
    severity: 'error',
  });
}

async function submit(order: Order, connection: Connection): Promise<void> {
  const db = getDb();
  const credentials = await loadCredentials(connection.id);
  const adapter = resolveAdapter(connection, credentials !== null);
  const result = await adapter.submitOrder(order, connection, credentials);

  if (result.filled) {
    await db.query(
      `UPDATE orders
         SET status = 'execute', broker_order_id = $2, filled_qty = $3,
             avg_fill_price = $4, submitted_at = COALESCE(submitted_at, now()),
             executed_at = now(), execution_venue = $5
       WHERE id = $1`,
      [order.id, result.brokerOrderId, result.filledQty, result.avgFillPrice, adapter.name]
    );
    await applyFill(order, result.avgFillPrice ?? 0, result.filledQty);
    return;
  }

  await db.query(
    `UPDATE orders
       SET status = 'soumis', broker_order_id = $2,
           submitted_at = COALESCE(submitted_at, now()), execution_venue = $3
     WHERE id = $1`,
    [order.id, result.brokerOrderId, adapter.name]
  );
}

async function poll(order: Order, connection: Connection): Promise<void> {
  const db = getDb();
  const credentials = await loadCredentials(connection.id);
  const adapter = resolveAdapter(connection, credentials !== null);
  const status = await adapter.getOrderStatus(order, connection, credentials);

  if (status.rejected) {
    await db.query(`UPDATE orders SET status = 'rejete', rejection_reason = $2 WHERE id = $1`, [
      order.id,
      status.reason ?? 'Rejeté par le courtier.',
    ]);
    return;
  }
  if (status.canceled) {
    await db.query(`UPDATE orders SET status = 'annule' WHERE id = $1`, [order.id]);
    return;
  }
  if (!status.filled) {
    if (status.filledQty > 0) {
      await db.query(
        `UPDATE orders SET status = 'execute_partiellement', filled_qty = $2, avg_fill_price = $3 WHERE id = $1`,
        [order.id, status.filledQty, status.avgFillPrice]
      );
    }
    return;
  }

  await db.query(
    `UPDATE orders SET status = 'execute', filled_qty = $2, avg_fill_price = $3, executed_at = now()
     WHERE id = $1`,
    [order.id, status.filledQty, status.avgFillPrice]
  );
  await applyFill(order, status.avgFillPrice ?? 0, status.filledQty);
}

/**
 * Advances pending orders one step. `valide` covers simulation subscriptions,
 * which are always routed to the simulated venue.
 */
export async function runExecutionTick(batchSize = 5): Promise<number> {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM orders WHERE status IN ('envoi_en_cours', 'soumis', 'valide')
     ORDER BY received_at ASC LIMIT $1`,
    [batchSize]
  );

  let handled = 0;

  for (const row of rows) {
    const order = mapOrder(row);
    const connection = await findConnection(order.connectionId);

    if (!connection) {
      await failOrder(order, 'Connexion introuvable au moment de la transmission.');
      handled += 1;
      continue;
    }

    try {
      if (order.brokerOrderId && order.status === 'soumis') {
        await poll(order, connection);
      } else {
        await submit(order, connection);
      }
      handled += 1;
    } catch (err) {
      const message =
        err instanceof BrokerError ? err.message : 'Erreur inattendue lors de la transmission.';
      if (err instanceof BrokerError && err.retryable) {
        console.error('[execution] erreur temporaire:', message);
      } else {
        await failOrder(order, message);
      }
      handled += 1;
    }
  }

  return handled;
}

/** Refreshes mark-to-market values for simulated positions. */
export async function repricePositions(): Promise<void> {
  const db = getDb();
  const { rows } = await db.query(`SELECT * FROM positions`);
  for (const row of rows) {
    const p = mapPosition(row);
    const price = Number((p.currentPrice * (1 + (Math.random() - 0.5) * 0.004)).toFixed(2));
    const pnl = (p.side === 'short' ? p.avgPrice - price : price - p.avgPrice) * p.qty;
    await db.query(
      `UPDATE positions SET current_price = $2, market_value = $3, pnl = $4, pnl_percent = $5 WHERE id = $1`,
      [
        p.id,
        price,
        Number((p.qty * price).toFixed(2)),
        Number(pnl.toFixed(2)),
        p.avgPrice === 0 ? 0 : Number(((pnl / (p.avgPrice * p.qty)) * 100).toFixed(2)),
      ]
    );
  }
}
