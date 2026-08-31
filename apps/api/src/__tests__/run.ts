import { createHmac } from 'crypto';
import type { Server } from 'http';
import { newDb } from 'pg-mem';
import { setDb, type Db } from '../db/pool';
import { seed } from '../db/seed';
import { createApp } from '../index';
import { runExecutionTick } from '../services/execution';
import { riskRuleTests } from './risk-rules';
import { brokerTests } from './brokers';
import { alertTests } from './alerts';
import { authTests } from './auth';

let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

async function main(): Promise<void> {
  process.env.CRON_SECRET = 'secret-de-cron-pour-les-tests-000';
  process.env.TICK_MIN_INTERVAL_MS = '0';

  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({
    name: 'now',
    returns: mem.public.getType('timestamptz' as never),
    implementation: () => new Date(),
  });

  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();
  setDb(pool as unknown as Db);

  await seed();

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  console.log('--- Authentification ---');
  await authTests(check, base, server);

  // Every protected call below reuses this session.
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@exemple.fr', password: 'MotDePasse123456' }),
  });
  const sessionCookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
  check('session de test établie', sessionCookie.length > 0, sessionCookie);

  console.log('\n--- Parcours métier ---');

  const json = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), cookie: sessionCookie },
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  // --- Schema & seed ------------------------------------------------------
  const state = await json('/api/state');
  check('GET /api/state renvoie 200', state.status === 200);
  check('seed: 4 stratégies', state.body.strategies.length === 4, String(state.body.strategies.length));
  check('seed: 4 connexions', state.body.connections.length === 4, String(state.body.connections.length));
  check('seed: 10 règles de risque', state.body.riskRules.length === 10, String(state.body.riskRules.length));
  check('seed: coupe-circuit désactivé', state.body.killSwitch === false);
  check(
    'les secrets API ne sont jamais exposés',
    !JSON.stringify(state.body.connections).includes('api_key') &&
      !JSON.stringify(state.body.connections).includes('demo-api-key')
  );

  // --- Strategy CRUD ------------------------------------------------------
  const created = await json('/api/strategies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Stratégie de test',
      description: 'Créée par la suite de tests automatisée.',
      status: 'active',
      assetClass: 'actions',
      allowedActions: ['buy', 'sell'],
      whitelist: ['AAPL', 'MSFT'],
      blacklist: [],
      maxSignalDelaySec: 60,
      rejectDuplicates: true,
      maxVolume: 100,
      maxExposure: 50000,
      defaultOrderType: 'market',
    }),
  });
  check('POST /api/strategies crée (201)', created.status === 201, JSON.stringify(created.body).slice(0, 120));
  check('la liste blanche est normalisée en tableau', Array.isArray(created.body?.whitelist) && created.body.whitelist.length === 2);
  check('un webhook est généré', typeof created.body?.webhookId === 'string' && created.body.webhookId.startsWith('wd_'));

  const invalid = await json('/api/strategies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ab' }),
  });
  check('payload invalide rejeté (422)', invalid.status === 422);

  const strategyId: string = created.body.id;
  const secret: string = created.body.webhookSecret;
  const webhookId: string = created.body.webhookId;

  // The seeded trading-hours rule would otherwise make this suite time-dependent.
  const disableHours = await json('/api/risk/rules/risk-010', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: '09:30–16:00 ET', enabled: false }),
  });
  check('règle de plage horaire désactivable', disableHours.body?.enabled === false, JSON.stringify(disableHours.body));

  // --- Subscription -------------------------------------------------------
  const sub = await json('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      strategyId,
      connectionId: 'conn-001',
      enabled: true,
      executionMode: 'automatique',
      sizingMethod: 'quantite_fixe',
      sizingValue: 5,
      maxOrderSize: 50,
      maxExposure: 40000,
      allowShort: false,
    }),
  });
  check('POST /api/subscriptions crée (201)', sub.status === 201, JSON.stringify(sub.body).slice(0, 120));

  // --- Webhook security ---------------------------------------------------
  const payload = JSON.stringify({
    signalId: 'sig-e2e-1',
    ticker: 'AAPL',
    action: 'buy',
    price: 200,
    source: 'Suite de tests',
  });

  const badSig = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign('mauvais-secret', payload) },
    body: payload,
  });
  check('signature invalide rejetée (401)', badSig.status === 401);

  const noSig = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  check('signature absente rejetée (401)', noSig.status === 401);

  const unknown = await json('/api/webhook/wd_inexistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign(secret, payload) },
    body: payload,
  });
  check('webhook inconnu rejeté (401)', unknown.status === 401);

  const tampered = JSON.stringify({ ...JSON.parse(payload), quantity: 99999 });
  const tamper = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign(secret, payload) },
    body: tampered,
  });
  check('corps altéré rejeté (401)', tamper.status === 401);

  const badShape = JSON.stringify({ ticker: 'AAPL', action: 'action_invalide' });
  const shape = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign(secret, badShape) },
    body: badShape,
  });
  check('payload webhook invalide rejeté (422)', shape.status === 422);

  // --- Signal accepted -> order created ----------------------------------
  const accepted = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign(secret, payload) },
    body: payload,
  });
  check('signal signé accepté (202)', accepted.status === 202, JSON.stringify(accepted.body));
  check('un ordre est créé', accepted.body?.ordersCreated === 1, JSON.stringify(accepted.body));

  // --- Deduplication ------------------------------------------------------
  const duplicate = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign(secret, payload) },
    body: payload,
  });
  check('doublon détecté', duplicate.body?.status === 'duplique', JSON.stringify(duplicate.body));

  // --- Kill switch blocks execution --------------------------------------
  await json('/api/risk/kill-switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true }),
  });
  const blockedPayload = JSON.stringify({
    signalId: 'sig-e2e-2',
    ticker: 'AAPL',
    action: 'buy',
    price: 200,
    source: 'Suite de tests',
  });
  const blocked = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign(secret, blockedPayload) },
    body: blockedPayload,
  });
  check('coupe-circuit bloque la création d’ordre', blocked.body?.ordersCreated === 0, JSON.stringify(blocked.body));
  check(
    'motif de rejet explicite',
    typeof blocked.body?.reason === 'string' && blocked.body.reason.includes('Coupe-circuit'),
    String(blocked.body?.reason)
  );
  await json('/api/risk/kill-switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false }),
  });

  // --- Whitelist enforcement ---------------------------------------------
  const offList = JSON.stringify({
    signalId: 'sig-e2e-3',
    ticker: 'TSLA',
    action: 'buy',
    price: 200,
    source: 'Suite de tests',
  });
  const rejectedTicker = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signaldesk-signature': sign(secret, offList) },
    body: offList,
  });
  check(
    'ticker hors liste blanche rejeté',
    rejectedTicker.body?.ordersCreated === 0 &&
      String(rejectedTicker.body?.reason).includes('liste blanche'),
    String(rejectedTicker.body?.reason)
  );

  // --- Execution worker fills the order ----------------------------------
  const beforeFill = await json('/api/orders');
  const submitted = beforeFill.body.items.filter((o: { status: string }) => o.status === 'soumis');
  check('ordre en statut soumis', submitted.length === 1, String(submitted.length));

  await runExecutionTick();

  const afterFill = await json('/api/orders');
  const executed = afterFill.body.items.filter((o: { status: string }) => o.status === 'execute');
  check('le worker exécute l’ordre', executed.length === 1, String(executed.length));
  check(
    'la route d’exécution est tracée',
    executed[0]?.executionVenue === 'simulation',
    String(executed[0]?.executionVenue)
  );

  // --- Pagination ---------------------------------------------------------
  const paged = await json('/api/orders?limit=1&offset=0');
  check('pagination : limite respectée', paged.body.items.length === 1, String(paged.body.items.length));
  check('pagination : total renvoyé', paged.body.total >= 1, String(paged.body.total));
  const pagedOffset = await json('/api/orders?limit=1&offset=1');
  check(
    'pagination : l’offset change de page',
    pagedOffset.body.items[0]?.id !== paged.body.items[0]?.id,
    `${paged.body.items[0]?.id} / ${pagedOffset.body.items[0]?.id}`
  );

  const positions = await json('/api/positions');
  check('une position est ouverte', positions.body.length === 1, JSON.stringify(positions.body));
  check('quantité de position correcte', positions.body[0]?.qty === 5, String(positions.body[0]?.qty));

  // --- Order actions ------------------------------------------------------
  const executedId = executed[0].id;
  const conflict = await json(`/api/orders/${executedId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel' }),
  });
  check('un ordre exécuté ne peut être annulé (409)', conflict.status === 409, String(conflict.status));

  // --- Simulation subscriptions are executed too --------------------------
  await json('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      strategyId,
      connectionId: 'conn-003',
      enabled: true,
      executionMode: 'simulation',
      sizingMethod: 'quantite_fixe',
      sizingValue: 3,
      maxOrderSize: 50,
      maxExposure: 40000,
      allowShort: false,
    }),
  });

  const simPayload = JSON.stringify({
    signalId: 'sig-e2e-sim',
    ticker: 'MSFT',
    action: 'buy',
    price: 150,
    source: 'Suite de tests',
  });
  const simSignal = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signaldesk-signature': sign(secret, simPayload),
    },
    body: simPayload,
  });
  check('signal routé vers deux abonnements', simSignal.body?.ordersCreated === 2, JSON.stringify(simSignal.body));

  const simOrders = await json('/api/orders?limit=500');
  const validated = simOrders.body.items.filter(
    (o: { signalId: string; status: string }) => o.signalId === 'sig-e2e-sim' && o.status === 'valide'
  );
  check('abonnement simulation crée un ordre validé', validated.length === 1, String(validated.length));

  await runExecutionTick(10);

  const afterSim = await json('/api/orders?limit=500');
  const simExecuted = afterSim.body.items.find(
    (o: { id: string }) => o.id === validated[0]?.id
  );
  check(
    'ordre en mode simulation exécuté',
    simExecuted?.status === 'execute',
    String(simExecuted?.status)
  );
  check(
    'exécution routée vers la place simulée',
    simExecuted?.executionVenue === 'simulation',
    String(simExecuted?.executionVenue)
  );

  // --- Realised P&L feeds the loss rules ----------------------------------
  const positionsBefore = await json('/api/positions');
  const msft = positionsBefore.body.find((p: { ticker: string }) => p.ticker === 'MSFT');
  if (msft) {
    await json(`/api/positions/${msft.id}`, { method: 'DELETE' });
  }
  const stateAfterClose = await json('/api/state');
  check(
    'la clôture manuelle retire la position',
    !stateAfterClose.body.positions.some((p: { id: string }) => p.id === msft?.id),
    String(msft?.id)
  );

  // --- Serverless cron endpoint ------------------------------------------
  const cronNoAuth = await json('/api/tasks/tick');
  check('cron sans secret rejeté (401)', cronNoAuth.status === 401, String(cronNoAuth.status));

  const cronWrong = await json('/api/tasks/tick', {
    headers: { authorization: 'Bearer mauvais-secret-de-la-meme-taille1' },
  });
  check('cron avec mauvais secret rejeté (401)', cronWrong.status === 401, String(cronWrong.status));

  const cronOk = await json('/api/tasks/tick', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  check('cron authentifié accepté (200)', cronOk.status === 200, JSON.stringify(cronOk.body));

  // --- Execution without any worker or cron (Vercel Hobby) ----------------
  const hobbyPayload = JSON.stringify({
    signalId: 'sig-e2e-hobby',
    ticker: 'MSFT',
    action: 'buy',
    price: 300,
    source: 'Suite de tests',
  });
  const hobbySignal = await json(`/api/webhook/${webhookId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signaldesk-signature': sign(secret, hobbyPayload),
    },
    body: hobbyPayload,
  });
  check(
    'signal accepté sans worker',
    hobbySignal.body?.ordersCreated === 2,
    JSON.stringify(hobbySignal.body)
  );

  // Reading the state is what advances the pending order.
  await json('/api/state');
  const afterState = await json('/api/state');
  const hobbyOrder = afterState.body.orders.find(
    (o: { signalId: string }) => o.signalId === 'sig-e2e-hobby'
  );
  check(
    'ordre exécuté via la seule lecture de /api/state',
    hobbyOrder?.status === 'execute',
    String(hobbyOrder?.status)
  );
  check(
    'position MSFT ouverte sans cron',
    afterState.body.positions.some((p: { ticker: string }) => p.ticker === 'MSFT'),
    JSON.stringify(afterState.body.positions.map((p: { ticker: string }) => p.ticker))
  );

  // --- Audit trail --------------------------------------------------------
  const audit = await json('/api/audit-logs');
  const actions = audit.body.items.map((a: { action: string }) => a.action);
  check('audit: création de stratégie journalisée', actions.includes('strategie.creation'));
  check('audit: coupe-circuit journalisé', actions.includes('risque.coupe_circuit_active'));

  // --- Deletion cascade ---------------------------------------------------
  const del = await json(`/api/strategies/${strategyId}`, { method: 'DELETE' });
  check('DELETE /api/strategies (204)', del.status === 204, String(del.status));
  const subsAfter = await json('/api/subscriptions');
  const orphan = subsAfter.body.filter((s: { strategyId: string }) => s.strategyId === strategyId);
  check('les abonnements sont supprimés en cascade', orphan.length === 0, String(orphan.length));

  // --- 404 ----------------------------------------------------------------
  const missing = await json('/api/strategies/strat-inexistante', {
    method: 'DELETE',
  });
  check('ressource inconnue renvoie 404', missing.status === 404, String(missing.status));

  server.close();

  console.log('\n--- Règles de risque ---');
  riskRuleTests(check);

  console.log('\n--- Adaptateurs courtiers ---');
  await brokerTests(check);

  console.log('\n--- Alertes externes ---');
  await alertTests(check);

  console.log(failures === 0 ? '\nTous les tests sont passés.' : `\n${failures} test(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
