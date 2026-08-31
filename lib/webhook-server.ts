import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookRegistration {
  webhookId: string;
  secret: string;
  strategyName: string;
}

export interface SignalEvent {
  seq: number;
  signalId: string;
  webhookId: string;
  ticker: string;
  action: string;
  quantity?: number;
  price?: number;
  orderType?: string;
  source: string;
  receivedAt: string;
}

interface WebhookStore {
  registry: Map<string, WebhookRegistration>;
  events: SignalEvent[];
  seq: number;
  hits: Map<string, number[]>;
}

const globalRef = globalThis as typeof globalThis & { __signaldesk?: WebhookStore };

function store(): WebhookStore {
  if (!globalRef.__signaldesk) {
    globalRef.__signaldesk = { registry: new Map(), events: [], seq: 0, hits: new Map() };
  }
  return globalRef.__signaldesk;
}

export function registerWebhooks(entries: WebhookRegistration[]): number {
  const s = store();
  s.registry.clear();
  entries.forEach((e) => s.registry.set(e.webhookId, e));
  return s.registry.size;
}

export function getRegistration(webhookId: string): WebhookRegistration | undefined {
  return store().registry.get(webhookId);
}

export function pushEvent(event: Omit<SignalEvent, 'seq'>): SignalEvent {
  const s = store();
  s.seq += 1;
  const stored: SignalEvent = { ...event, seq: s.seq };
  s.events.push(stored);
  if (s.events.length > 200) s.events.splice(0, s.events.length - 200);
  return stored;
}

export function eventsSince(cursor: number): { events: SignalEvent[]; cursor: number } {
  const s = store();
  return { events: s.events.filter((e) => e.seq > cursor), cursor: s.seq };
}

/** Fixed-window limiter guarding the public ingestion endpoint. */
export function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const s = store();
  const now = Date.now();
  const hits = (s.hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    s.hits.set(key, hits);
    return false;
  }
  hits.push(now);
  s.hits.set(key, hits);
  return true;
}

export function verifySignature(rawBody: string, secret: string, signature: string): boolean {
  const provided = signature.trim().replace(/^sha256=/i, '');
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
