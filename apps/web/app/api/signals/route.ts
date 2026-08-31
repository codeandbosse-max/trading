import { NextRequest, NextResponse } from 'next/server';
import { eventsSince } from '@/lib/webhook-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('cursor') ?? '0';
  const cursor = Number.parseInt(raw, 10);
  const result = eventsSince(Number.isFinite(cursor) && cursor >= 0 ? cursor : 0);
  return NextResponse.json(result);
}
