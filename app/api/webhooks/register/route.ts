import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registerWebhooks } from '@/lib/webhook-server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  webhooks: z
    .array(
      z.object({
        webhookId: z.string().trim().min(3).max(64),
        secret: z.string().trim().min(8).max(200),
        strategyName: z.string().trim().min(1).max(80),
      })
    )
    .max(100),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enregistrement invalide.' }, { status: 422 });
  }
  const count = registerWebhooks(parsed.data.webhooks);
  return NextResponse.json({ registered: count });
}
