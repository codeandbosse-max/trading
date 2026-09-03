import { Router, raw } from 'express';
import { timingSafeEqual } from 'crypto';
import { tradingViewPayloadSchema, type IncomingSignal } from '@trading/shared';
import { findStrategyByWebhookId } from '../repositories/queries';
import { processSignal } from '../services/signal-processor';
import { asyncHandler } from '../middleware/errors';

export const tradingViewRouter = Router();

const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT = 60;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Dedicated TradingView relay. TradingView cannot attach custom HMAC headers,
 * so the strategy secret is supplied as `passphrase` in the alert JSON.
 */
tradingViewRouter.post(
  '/:webhookId',
  raw({ type: '*/*', limit: MAX_BODY_BYTES }),
  asyncHandler(async (req, res) => {
    const webhookId = req.params.webhookId;
    const ip = req.ip ?? 'local';

    if (rateLimited(`${ip}:${webhookId}`)) {
      res.status(429).json({ error: 'Trop de requêtes.' });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ error: 'JSON invalide.' });
      return;
    }

    const parsed = tradingViewPayloadSchema.safeParse(json);
    if (!parsed.success) {
      res.status(422).json({
        error: 'Alerte TradingView invalide.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const strategy = await findStrategyByWebhookId(webhookId);
    const payload = parsed.data;

    // Same response for a missing strategy or incorrect phrase: no endpoint enumeration.
    if (!strategy || !secretMatches(payload.passphrase, strategy.webhookSecret)) {
      res.status(401).json({ error: 'Phrase secrète invalide.' });
      return;
    }

    const signal: IncomingSignal = {
      signalId: payload.signalId ?? payload.signal_id ?? `tv-${Date.now().toString(36)}`,
      webhookId,
      ticker: payload.ticker.toUpperCase(),
      action: payload.action,
      quantity: payload.quantity,
      price: payload.price,
      stopLoss: payload.stopLoss ?? payload.stop_loss,
      orderType: payload.orderType ?? payload.order_type,
      source: 'TradingView',
      receivedAt: new Date().toISOString(),
      emittedAt: payload.timestamp,
    };

    const result = await processSignal(signal);
    res.status(202).json({
      accepted: result.log.status === 'accepte',
      status: result.log.status,
      signalId: signal.signalId,
      strategy: strategy.name,
      ordersCreated: result.orders.length,
      reason: result.log.reason,
    });
  })
);
