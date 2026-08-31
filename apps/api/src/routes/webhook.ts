import { Router, raw } from 'express';
import { webhookPayloadSchema, type IncomingSignal } from '@trading/shared';
import { config } from '../config';
import { verifySignature } from '../lib/crypto';
import { findStrategyByWebhookId } from '../repositories/queries';
import { processSignal } from '../services/signal-processor';
import { asyncHandler } from '../middleware/errors';

export const webhookRouter = Router();

const MAX_BODY_BYTES = 8 * 1024;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= config.webhookRateLimit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

webhookRouter.post(
  '/:webhookId',
  raw({ type: '*/*', limit: MAX_BODY_BYTES }),
  asyncHandler(async (req, res) => {
    const { webhookId } = req.params;
    const ip = req.ip ?? 'local';

    if (rateLimited(`${ip}:${webhookId}`)) {
      res.status(429).json({ error: 'Trop de requêtes.' });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const signature =
      (req.header('x-signaldesk-signature') ?? req.header('x-signature') ?? '').trim();
    const strategy = await findStrategyByWebhookId(webhookId);

    // Identical response for unknown endpoint and bad signature: no enumeration.
    if (!strategy || !signature || !verifySignature(rawBody, strategy.webhookSecret, signature)) {
      res.status(401).json({ error: 'Signature invalide.' });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ error: 'JSON invalide.' });
      return;
    }

    const parsed = webhookPayloadSchema.safeParse(json);
    if (!parsed.success) {
      res
        .status(422)
        .json({ error: 'Charge utile invalide.', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const payload = parsed.data;
    const signal: IncomingSignal = {
      signalId: payload.signalId ?? `sig-${Date.now().toString(36)}`,
      webhookId,
      ticker: payload.ticker.toUpperCase(),
      action: payload.action,
      quantity: payload.quantity,
      price: payload.price,
      orderType: payload.orderType,
      source: payload.source ?? 'Webhook externe',
      receivedAt: new Date().toISOString(),
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
