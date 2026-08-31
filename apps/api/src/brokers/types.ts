import type { Connection, Order } from '@trading/shared';

export interface BrokerCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface SubmitResult {
  brokerOrderId: string;
  /** `true` when the venue reports the order as already filled. */
  filled: boolean;
  filledQty: number;
  avgFillPrice: number | null;
}

export interface StatusResult {
  filled: boolean;
  canceled: boolean;
  rejected: boolean;
  filledQty: number;
  avgFillPrice: number | null;
  reason?: string;
}

export interface BrokerAdapter {
  readonly name: string;
  submitOrder(
    order: Order,
    connection: Connection,
    credentials: BrokerCredentials | null
  ): Promise<SubmitResult>;
  getOrderStatus(
    order: Order,
    connection: Connection,
    credentials: BrokerCredentials | null
  ): Promise<StatusResult>;
  cancelOrder(
    order: Order,
    connection: Connection,
    credentials: BrokerCredentials | null
  ): Promise<void>;
}

export class BrokerError extends Error {
  constructor(
    message: string,
    public readonly retryable = false
  ) {
    super(message);
  }
}
