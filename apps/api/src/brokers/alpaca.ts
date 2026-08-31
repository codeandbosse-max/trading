import type { Connection, Order } from '@trading/shared';
import { config } from '../config';
import { BrokerError, type BrokerAdapter, type BrokerCredentials, type StatusResult, type SubmitResult } from './types';

const PAPER_URL = 'https://paper-api.alpaca.markets';
const LIVE_URL = 'https://api.alpaca.markets';

export function alpacaBaseUrl(connection: Connection): string {
  if (config.alpacaBaseUrl) return config.alpacaBaseUrl;
  return connection.env === 'reel' ? LIVE_URL : PAPER_URL;
}

function headers(credentials: BrokerCredentials): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'APCA-API-KEY-ID': credentials.apiKey,
    'APCA-API-SECRET-KEY': credentials.apiSecret,
  };
}

function requireCredentials(credentials: BrokerCredentials | null): BrokerCredentials {
  if (!credentials?.apiKey || !credentials.apiSecret) {
    throw new BrokerError('Identifiants Alpaca absents pour cette connexion.');
  }
  return credentials;
}

async function call(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000
): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch (err) {
    throw new BrokerError(
      `Alpaca injoignable : ${err instanceof Error ? err.message : 'erreur réseau'}`,
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

function mapTimeInForce(value: string): string {
  return ['day', 'gtc', 'opg', 'cls', 'ioc', 'fok'].includes(value) ? value : 'day';
}

function toStatus(body: any, fallbackQty: number): StatusResult {
  const filledQty = Number.parseFloat(body?.filled_qty ?? '0') || 0;
  const avgPrice = body?.filled_avg_price ? Number.parseFloat(body.filled_avg_price) : null;
  const state = String(body?.status ?? '');
  return {
    filled: state === 'filled' || filledQty >= fallbackQty,
    canceled: state === 'canceled' || state === 'expired',
    rejected: state === 'rejected' || state === 'suspended',
    filledQty,
    avgFillPrice: avgPrice,
    reason: body?.reason ?? undefined,
  };
}

export const alpacaAdapter: BrokerAdapter = {
  name: 'alpaca',

  async submitOrder(order: Order, connection: Connection, credentials): Promise<SubmitResult> {
    const creds = requireCredentials(credentials);
    const payload: Record<string, unknown> = {
      symbol: order.ticker,
      qty: String(order.quantity),
      side: order.side === 'achat' ? 'buy' : 'sell',
      type: order.orderType === 'stop_limit' ? 'stop_limit' : order.orderType,
      time_in_force: mapTimeInForce(order.timeInForce),
      client_order_id: order.id,
    };
    if (order.limitPrice !== null) payload.limit_price = String(order.limitPrice);
    if (order.stopPrice !== null) payload.stop_price = String(order.stopPrice);

    const { status, body } = await call(`${alpacaBaseUrl(connection)}/v2/orders`, {
      method: 'POST',
      headers: headers(creds),
      body: JSON.stringify(payload),
    });

    if (status >= 400) {
      throw new BrokerError(
        `Alpaca a refusé l'ordre (${status}) : ${body?.message ?? 'motif inconnu'}`,
        status >= 500
      );
    }

    const mapped = toStatus(body, order.quantity);
    return {
      brokerOrderId: String(body?.id ?? ''),
      filled: mapped.filled,
      filledQty: mapped.filledQty,
      avgFillPrice: mapped.avgFillPrice,
    };
  },

  async getOrderStatus(order: Order, connection: Connection, credentials): Promise<StatusResult> {
    const creds = requireCredentials(credentials);
    const { status, body } = await call(
      `${alpacaBaseUrl(connection)}/v2/orders/${order.brokerOrderId}`,
      { method: 'GET', headers: headers(creds) }
    );
    if (status >= 400) {
      throw new BrokerError(`Statut Alpaca indisponible (${status}).`, status >= 500);
    }
    return toStatus(body, order.quantity);
  },

  async cancelOrder(order: Order, connection: Connection, credentials): Promise<void> {
    const creds = requireCredentials(credentials);
    const { status } = await call(
      `${alpacaBaseUrl(connection)}/v2/orders/${order.brokerOrderId}`,
      { method: 'DELETE', headers: headers(creds) }
    );
    // 404 means the order is already gone, which satisfies the intent.
    if (status >= 400 && status !== 404) {
      throw new BrokerError(`Annulation refusée par Alpaca (${status}).`);
    }
  },
};
