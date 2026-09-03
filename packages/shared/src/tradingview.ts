import { z } from 'zod';
import { signalActions, orderTypes } from './schemas';

/**
 * TradingView sends only a JSON body. `passphrase` is mandatory because it is
 * the authentication factor used by the relay in place of an HMAC header.
 */
export const tradingViewPayloadSchema = z
  .object({
    passphrase: z.string().trim().min(16).max(256),
    signalId: z.string().trim().min(1).max(100).optional(),
    signal_id: z.string().trim().min(1).max(100).optional(),
    ticker: z.string().trim().min(1).max(20),
    action: z.enum(signalActions),
    quantity: z.number().positive().max(1_000_000).optional(),
    price: z.number().positive().max(10_000_000).optional(),
    stopLoss: z.number().positive().max(10_000_000).optional(),
    stop_loss: z.number().positive().max(10_000_000).optional(),
    orderType: z.enum(orderTypes).optional(),
    order_type: z.enum(orderTypes).optional(),
    timestamp: z.string().trim().max(40).optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.signalId && payload.signal_id && payload.signalId !== payload.signal_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['signalId'],
        message: 'signalId et signal_id ne correspondent pas.',
      });
    }
  });

export type TradingViewPayload = z.infer<typeof tradingViewPayloadSchema>;
