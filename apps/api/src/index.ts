import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { router } from './routes/resources';
import { webhookRouter } from './routes/webhook';
import { errorHandler, notFound } from './middleware/errors';
import { repricePositions, runExecutionTick } from './services/execution';
import { tasksRouter } from './routes/tasks';
import { setDb, type Db } from './db/pool';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Mounted before the JSON parser: signature verification needs the raw body.
  app.use('/api/webhook', webhookRouter);

  app.use(express.json({ limit: '256kb' }));
  app.use('/api/tasks', tasksRouter);
  app.use('/api', router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export function startWorkers(): NodeJS.Timeout[] {
  const execution = setInterval(() => {
    runExecutionTick().catch((err) => console.error('[worker] exécution:', err));
  }, 4000);

  const pricing = setInterval(() => {
    repricePositions().catch((err) => console.error('[worker] valorisation:', err));
  }, 10000);

  return [execution, pricing];
}

if (require.main === module) {
  const bootstrap = async () => {
    if (!config.databaseUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL est obligatoire en production.');
      }
      await useInMemoryDatabase();
    }

    const app = createApp();
    app.listen(config.port, () => {
      console.log(`[api] à l'écoute sur http://localhost:${config.port}`);
    });
    startWorkers();
  };

  bootstrap().catch((err) => {
    console.error('[api] démarrage impossible:', err);
    process.exit(1);
  });
}

/** Development fallback so the stack runs without a PostgreSQL server. */
async function useInMemoryDatabase(): Promise<void> {
  const { newDb } = await import('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({
    name: 'now',
    returns: mem.public.getType('timestamptz' as never),
    implementation: () => new Date(),
  });
  const adapter = mem.adapters.createPg();
  setDb(new adapter.Pool() as unknown as Db);

  const { seed } = await import('./db/seed');
  await seed();
  console.warn(
    '[api] DATABASE_URL absent : base PostgreSQL en mémoire (données perdues à l’arrêt).'
  );
}
