import { createServer, type Server } from 'http';
import type { Connection, Order } from '@trading/shared';
import { alpacaAdapter, resolveAdapter, simulationAdapter, BrokerError } from '../brokers';

type Check = (name: string, ok: boolean, detail?: string) => void;

interface Received {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** Minimal Alpaca stand-in so the HTTP path is exercised for real. */
function startFakeAlpaca(received: Received[]): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });

      if (req.method === 'POST' && req.url === '/v2/orders') {
        const parsed = JSON.parse(body || '{}');
        if (parsed.symbol === 'REFUSE') {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'insufficient buying power' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'alp-123', status: 'accepted', filled_qty: '0' }));
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/v2/orders/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ id: 'alp-123', status: 'filled', filled_qty: '5', filled_avg_price: '201.5' })
        );
        return;
      }

      if (req.method === 'DELETE') {
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const order: Order = {
  id: 'ord-test',
  signalId: 'sig-test',
  ticker: 'AAPL',
  action: 'buy',
  side: 'achat',
  quantity: 5,
  orderType: 'market',
  limitPrice: null,
  stopPrice: null,
  timeInForce: 'day',
  status: 'soumis',
  strategyId: 'strat',
  strategyName: 'Test',
  connectionId: 'conn',
  connectionName: 'Compte',
  brokerOrderId: null,
  filledQty: 0,
  avgFillPrice: null,
  rejectionReason: null,
  receivedAt: new Date().toISOString(),
  submittedAt: null,
  executedAt: null,
  executionVenue: 'simulation',
};

function connection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: 'conn',
    name: 'Compte',
    broker: 'Alpaca',
    env: 'demonstration',
    status: 'actif',
    currency: 'USD',
    buyingPower: 100000,
    equity: 100000,
    positionsCount: 0,
    lastTestAt: new Date().toISOString(),
    allowedInstruments: [],
    ...overrides,
  };
}

export async function brokerTests(check: Check): Promise<void> {
  const received: Received[] = [];
  const { server, url } = await startFakeAlpaca(received);
  process.env.ALPACA_BASE_URL = url;

  const credentials = { apiKey: 'KEY-123456', apiSecret: 'SECRET-123456' };

  // --- Adapter selection --------------------------------------------------
  check(
    'connexion simulation → adaptateur simulé',
    resolveAdapter(connection({ env: 'simulation' }), true).name === 'simulation'
  );
  check(
    'sans identifiants → adaptateur simulé',
    resolveAdapter(connection(), false).name === 'simulation'
  );
  check(
    'courtier inconnu → adaptateur simulé',
    resolveAdapter(connection({ broker: 'Courtier Inconnu' }), true).name === 'simulation'
  );
  check(
    'démonstration avec identifiants → adaptateur Alpaca',
    resolveAdapter(connection(), true).name === 'alpaca'
  );

  process.env.ALLOW_LIVE_TRADING = 'false';
  let guarded = false;
  try {
    resolveAdapter(connection({ env: 'reel' }), true);
  } catch (err) {
    guarded = err instanceof BrokerError;
  }
  check('compte réel bloqué sans ALLOW_LIVE_TRADING', guarded);

  process.env.ALLOW_LIVE_TRADING = 'true';
  check(
    'compte réel autorisé avec ALLOW_LIVE_TRADING',
    resolveAdapter(connection({ env: 'reel' }), true).name === 'alpaca'
  );
  process.env.ALLOW_LIVE_TRADING = 'false';

  // --- Real HTTP round-trip ----------------------------------------------
  const submitted = await alpacaAdapter.submitOrder(order, connection(), credentials);
  check('soumission Alpaca renvoie l’identifiant courtier', submitted.brokerOrderId === 'alp-123', submitted.brokerOrderId);
  check('ordre non rempli immédiatement', submitted.filled === false);

  const request = received.find((r) => r.method === 'POST');
  check('authentification transmise dans les en-têtes', request?.headers['apca-api-key-id'] === 'KEY-123456');
  check('secret transmis dans les en-têtes', request?.headers['apca-api-secret-key'] === 'SECRET-123456');
  const sentBody = JSON.parse(request?.body ?? '{}');
  check('charge utile Alpaca correcte', sentBody.symbol === 'AAPL' && sentBody.side === 'buy' && sentBody.qty === '5', request?.body);
  check('identifiant client transmis pour idempotence', sentBody.client_order_id === 'ord-test');

  const status = await alpacaAdapter.getOrderStatus(
    { ...order, brokerOrderId: 'alp-123' },
    connection(),
    credentials
  );
  check('statut Alpaca interprété comme exécuté', status.filled && status.filledQty === 5, JSON.stringify(status));
  check('prix moyen récupéré', status.avgFillPrice === 201.5, String(status.avgFillPrice));

  // --- Error handling -----------------------------------------------------
  let refused: unknown = null;
  try {
    await alpacaAdapter.submitOrder({ ...order, ticker: 'REFUSE' }, connection(), credentials);
  } catch (err) {
    refused = err;
  }
  check(
    'refus courtier remonté en BrokerError',
    refused instanceof BrokerError && refused.message.includes('insufficient buying power'),
    refused instanceof Error ? refused.message : ''
  );

  let missingCreds: unknown = null;
  try {
    await alpacaAdapter.submitOrder(order, connection(), null);
  } catch (err) {
    missingCreds = err;
  }
  check('identifiants manquants refusés', missingCreds instanceof BrokerError);

  // --- Simulation adapter --------------------------------------------------
  const simulated = await simulationAdapter.submitOrder(order, connection(), null);
  check('adaptateur simulé remplit immédiatement', simulated.filled && simulated.filledQty === 5);

  server.close();
  delete process.env.ALPACA_BASE_URL;
}
