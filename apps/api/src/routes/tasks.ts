import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { repricePositions, runExecutionTick } from '../services/execution';
import { asyncHandler } from '../middleware/errors';

export const tasksRouter = Router();

function authorized(header: string | undefined): boolean {
  if (!config.cronSecret) return false;
  const provided = (header ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(provided);
  const b = Buffer.from(config.cronSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Replaces the long-running workers when the API runs on a serverless platform. */
const handler = asyncHandler(async (req, res) => {
  if (!authorized(req.header('authorization'))) {
    res.status(401).json({ error: 'Non autorisé.' });
    return;
  }
  const handled = await runExecutionTick(20);
  await repricePositions();
  res.json({ ordersHandled: handled });
});

// Vercel Cron appelle en GET ; POST reste disponible pour un déclenchement manuel.
tasksRouter.get('/tick', handler);
tasksRouter.post('/tick', handler);
