import { createServer, type Server } from 'http';
import type { NotificationItem } from '@trading/shared';
import { dispatchAlert } from '../services/alerts';

type Check = (name: string, ok: boolean, detail?: string) => void;

interface Capture {
  path: string;
  body: string;
}

function startCollector(captured: Capture[]): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      captured.push({ path: req.url ?? '', body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
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

function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'notif-1',
    type: 'risque',
    title: 'Coupe-circuit activé',
    message: 'Toutes les exécutions sont suspendues.',
    severity: 'error',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

export async function alertTests(check: Check): Promise<void> {
  const captured: Capture[] = [];
  const { server, url } = await startCollector(captured);

  process.env.ALERT_WEBHOOK_URL = `${url}/generic`;
  process.env.CHAT_WEBHOOK_URL = `${url}/chat`;
  process.env.ALERT_MIN_SEVERITY = 'warning';
  delete process.env.SMTP_URL;

  await dispatchAlert(notification());

  const generic = captured.find((c) => c.path === '/generic');
  const chat = captured.find((c) => c.path === '/chat');

  check('alerte envoyée au webhook générique', generic !== undefined);
  check(
    'charge utile générique complète',
    generic !== undefined && JSON.parse(generic.body).title === 'Coupe-circuit activé',
    generic?.body
  );

  check('alerte envoyée au webhook de messagerie', chat !== undefined);
  const chatBody = chat ? JSON.parse(chat.body) : {};
  check('format compatible Slack (text)', typeof chatBody.text === 'string' && chatBody.text.includes('Coupe-circuit'));
  check('format compatible Discord (content)', typeof chatBody.content === 'string');

  // Severity filtering.
  captured.length = 0;
  await dispatchAlert(notification({ severity: 'info', title: 'Signal accepté' }));
  check('alerte info filtrée par le seuil de sévérité', captured.length === 0, String(captured.length));

  captured.length = 0;
  process.env.ALERT_MIN_SEVERITY = 'info';
  await dispatchAlert(notification({ severity: 'info', title: 'Signal accepté' }));
  check('seuil abaissé : l’alerte info passe', captured.length === 2, String(captured.length));

  // A failing endpoint must not throw.
  captured.length = 0;
  process.env.ALERT_WEBHOOK_URL = 'http://127.0.0.1:1/inexistant';
  process.env.CHAT_WEBHOOK_URL = '';
  let threw = false;
  try {
    await dispatchAlert(notification());
  } catch {
    threw = true;
  }
  check('un canal en panne ne fait pas échouer l’alerte', !threw);

  server.close();
  delete process.env.ALERT_WEBHOOK_URL;
  delete process.env.CHAT_WEBHOOK_URL;
  delete process.env.ALERT_MIN_SEVERITY;
}
