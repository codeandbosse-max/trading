import { NextRequest, NextResponse } from 'next/server';
import { webhookPayloadSchema } from '@/lib/schemas';
import {
  getRegistration,
  pushEvent,
  rateLimit,
  verifySignature,
} from '@/lib/webhook-server';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  const { webhookId } = params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

  if (!rateLimit(`${ip}:${webhookId}`)) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Charge utile trop volumineuse.' }, { status: 413 });
  }

  const registration = getRegistration(webhookId);
  const signature =
    request.headers.get('x-signaldesk-signature') ?? request.headers.get('x-signature') ?? '';

  // Same response for unknown endpoint and bad signature: no endpoint enumeration.
  if (!registration || !signature || !verifySignature(rawBody, registration.secret, signature)) {
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const parsed = webhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Charge utile invalide.', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const payload = parsed.data;
  const event = pushEvent({
    signalId: payload.signalId ?? `sig-${Date.now().toString(36)}`,
    webhookId,
    ticker: payload.ticker.toUpperCase(),
    action: payload.action,
    quantity: payload.quantity,
    price: payload.price,
    orderType: payload.orderType,
    source: payload.source ?? 'Webhook externe',
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json(
    { accepted: true, signalId: event.signalId, strategy: registration.strategyName },
    { status: 202 }
  );
}
