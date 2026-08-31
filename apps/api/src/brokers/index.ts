import type { Connection } from '@trading/shared';
import { config } from '../config';
import { alpacaAdapter } from './alpaca';
import { simulationAdapter } from './simulation';
import { BrokerError, type BrokerAdapter } from './types';

const adapters: Record<string, BrokerAdapter> = {
  alpaca: alpacaAdapter,
};

/**
 * Picks the venue for a connection. Real routing requires both an implemented
 * adapter and, for live accounts, an explicit opt-in.
 */
export function resolveAdapter(connection: Connection, hasCredentials: boolean): BrokerAdapter {
  const adapter = adapters[connection.broker.trim().toLowerCase()];

  if (!adapter || !hasCredentials || connection.env === 'simulation') {
    return simulationAdapter;
  }

  if (connection.env === 'reel' && !config.allowLiveTrading) {
    throw new BrokerError(
      `Envoi d'ordres réels désactivé : positionnez ALLOW_LIVE_TRADING=true pour autoriser ${connection.name}.`
    );
  }

  return adapter;
}

export { simulationAdapter, alpacaAdapter };
export * from './types';
