'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { SignalAction } from '@/lib/mock-data';

/**
 * Publishes webhook credentials to the ingestion API and polls accepted signals
 * back into the client store.
 */
export function SignalBridge() {
  const { state, hydrated, ingestSignal } = useStore();
  const cursor = useRef(0);
  const strategiesRef = useRef(state.strategies);
  strategiesRef.current = state.strategies;
  const ingestRef = useRef(ingestSignal);
  ingestRef.current = ingestSignal;

  const registrationKey = state.strategies
    .map((s) => `${s.webhookId}:${s.webhookSecret}`)
    .join('|');

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    fetch('/api/webhooks/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        webhooks: strategiesRef.current.map((s) => ({
          webhookId: s.webhookId,
          secret: s.webhookSecret,
          strategyName: s.name,
        })),
      }),
    }).catch(() => {
      // Ingestion API unreachable: the dashboard keeps working offline.
    });
    return () => controller.abort();
  }, [hydrated, registrationKey]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/signals?cursor=${cursor.current}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          cursor: number;
          events: {
            signalId: string;
            webhookId: string;
            ticker: string;
            action: string;
            quantity?: number;
            price?: number;
            orderType?: string;
            source: string;
            receivedAt: string;
          }[];
        };
        if (cancelled) return;
        cursor.current = data.cursor;
        data.events.forEach((e) =>
          ingestRef.current({ ...e, action: e.action as SignalAction })
        );
      } catch {
        // Network hiccup: retried on the next tick.
      }
    };

    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hydrated]);

  return null;
}
