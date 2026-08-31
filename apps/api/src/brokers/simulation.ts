import { randomBytes } from 'crypto';
import type { Connection, Order } from '@trading/shared';
import type { BrokerAdapter, StatusResult, SubmitResult } from './types';

/** Fills orders immediately at a price derived from the signal. No network call. */
export const simulationAdapter: BrokerAdapter = {
  name: 'simulation',

  async submitOrder(order: Order): Promise<SubmitResult> {
    const reference = order.limitPrice ?? order.stopPrice ?? 100;
    const slippage = 1 + (Math.random() - 0.5) * 0.002;
    return {
      brokerOrderId: `SIM-${randomBytes(4).toString('hex').toUpperCase()}`,
      filled: true,
      filledQty: order.quantity,
      avgFillPrice: Number((reference * slippage).toFixed(2)),
    };
  },

  async getOrderStatus(order: Order): Promise<StatusResult> {
    return {
      filled: true,
      canceled: false,
      rejected: false,
      filledQty: order.quantity,
      avgFillPrice: order.avgFillPrice ?? order.limitPrice ?? order.stopPrice ?? 100,
    };
  },

  async cancelOrder(_order: Order, _connection: Connection): Promise<void> {
    // Nothing to cancel: simulated orders never reach a venue.
  },
};
