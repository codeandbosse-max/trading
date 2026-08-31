import type { Order, Position } from '@trading/shared';
import { getDb } from '../db/pool';
import { uid } from '../lib/crypto';
import { mapOrder, mapPosition } from '../repositories/queries';

async function upsertPositionFromFill(order: Order, fillPrice: number): Promise<void> {
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
        order.quantity,
        direction === 1 ? 'long' : 'short',
        fillPrice,
        fillPrice,
        Number((order.quantity * fillPrice).toFixed(2)),
      ]
    );
    return;
  }

  const signedExisting = existing.qty * (existing.side === 'short' ? -1 : 1);
  const net = signedExisting + direction * order.quantity;

  if (net === 0) {
    await db.query(`DELETE FROM positions WHERE id = $1`, [existing.id]);
    return;
  }

  const increasing = Math.sign(net) === direction && Math.abs(net) > Math.abs(signedExisting);
  const qty = Math.abs(net);
  const avgPrice = increasing
    ? (existing.avgPrice * existing.qty + fillPrice * order.quantity) /
      (existing.qty + order.quantity)
    : existing.avgPrice;
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
      Number(((pnl / (avgPrice * qty)) * 100).toFixed(2)),
      existing.id,
    ]
  );
}

/**
 * Advances pending orders one step: queued orders reach the broker,
 * submitted orders fill and update the corresponding position.
 */
export async function runExecutionTick(batchSize = 5): Promise<number> {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM orders WHERE status IN ('envoi_en_cours', 'soumis')
     ORDER BY received_at ASC LIMIT $1`,
    [batchSize]
  );

  let handled = 0;

  for (const row of rows) {
    const order = mapOrder(row);

    if (order.status === 'envoi_en_cours') {
      await db.query(
        `UPDATE orders SET status = 'soumis', broker_order_id = COALESCE(broker_order_id, $2), submitted_at = now()
         WHERE id = $1`,
        [order.id, uid('brk').toUpperCase()]
      );
      handled += 1;
      continue;
    }

    const reference = order.limitPrice ?? order.stopPrice ?? 100;
    const fillPrice = Number((reference * (1 + (Math.random() - 0.5) * 0.002)).toFixed(2));

    await db.query(
      `UPDATE orders SET status = 'execute', filled_qty = quantity, avg_fill_price = $2, executed_at = now()
       WHERE id = $1`,
      [order.id, fillPrice]
    );
    await upsertPositionFromFill(order, fillPrice);
    handled += 1;
  }

  return handled;
}

/** Refreshes mark-to-market values for open positions. */
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
