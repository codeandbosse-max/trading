import { config } from '../config';
import { repricePositions, runExecutionTick } from './execution';

let lastRun = 0;
let inFlight: Promise<void> | null = null;

/**
 * Serverless platforms have no long-running workers, and Vercel Hobby only allows
 * a daily cron. Pending orders are therefore advanced while serving read requests,
 * throttled so a burst of polls does not multiply the work.
 */
export async function maybeRunTick(): Promise<void> {
  if (inFlight) return inFlight;

  const now = Date.now();
  if (now - lastRun < config.tickMinIntervalMs) return;
  lastRun = now;

  inFlight = (async () => {
    try {
      await runExecutionTick(10);
      await repricePositions();
    } catch (err) {
      console.error('[tick] échec:', err);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
