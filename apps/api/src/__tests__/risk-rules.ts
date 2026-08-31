import {
  evaluateRisk,
  type Connection,
  type IncomingSignal,
  type Position,
  type RiskContext,
  type RiskRule,
  type Strategy,
  type Subscription,
} from '@trading/shared';

type Check = (name: string, ok: boolean, detail?: string) => void;

const RULES: Record<string, { label: string; value: string }> = {
  'risk-001': { label: 'Montant maximal par ordre', value: '25 000 $' },
  'risk-002': { label: 'Quantité maximale par ordre', value: '500' },
  'risk-003': { label: 'Position maximale par ticker', value: '50 000 $' },
  'risk-004': { label: 'Exposition maximale par compte', value: '100 000 $' },
  'risk-005': { label: 'Ordres par jour', value: '50' },
  'risk-006': { label: 'Perte journalière maximale', value: '3 000 $' },
  'risk-007': { label: 'Pertes consécutives maximales', value: '5' },
  'risk-008': { label: 'Stop-loss obligatoire', value: 'Activé (futures, crypto)' },
  'risk-009': { label: 'Validation manuelle au-delà de', value: '10 000 $' },
  'risk-010': { label: 'Plage horaire autorisée', value: '09:30–16:00 ET' },
};

/** Only the rules passed in are enabled; every other rule is switched off. */
function rules(enabled: Record<string, string | true>): RiskRule[] {
  return Object.entries(RULES).map(([id, def]) => {
    const override = enabled[id];
    return {
      id,
      label: def.label,
      description: '',
      value: typeof override === 'string' ? override : def.value,
      enabled: override !== undefined,
      triggered: false,
    };
  });
}

const connection: Connection = {
  id: 'conn-001',
  name: 'Compte test',
  broker: 'Alpaca',
  env: 'simulation',
  status: 'actif',
  currency: 'USD',
  buyingPower: 1_000_000,
  equity: 1_000_000,
  positionsCount: 0,
  lastTestAt: new Date().toISOString(),
  allowedInstruments: [],
};

const strategy: Strategy = {
  id: 'strat-001',
  name: 'Test',
  description: '',
  status: 'active',
  assetClass: 'actions',
  allowedActions: ['buy', 'sell', 'short'],
  whitelist: [],
  blacklist: [],
  webhookId: 'wd_test',
  webhookSecret: 'secret',
  maxSignalDelaySec: 60,
  rejectDuplicates: true,
  maxVolume: 10_000,
  maxExposure: 10_000_000,
  defaultOrderType: 'market',
  subscriptionsCount: 1,
  signalsToday: 0,
  createdAt: new Date().toISOString(),
};

const subscription: Subscription = {
  id: 'sub-001',
  strategyId: strategy.id,
  connectionId: connection.id,
  enabled: true,
  executionMode: 'automatique',
  sizingMethod: 'quantite_fixe',
  sizingValue: 10,
  maxOrderSize: 10_000,
  maxExposure: 10_000_000,
  allowShort: true,
  tickerOverride: null,
};

function signal(overrides: Partial<IncomingSignal> = {}): IncomingSignal {
  const now = new Date().toISOString();
  return {
    signalId: 'sig-risk',
    webhookId: strategy.webhookId,
    ticker: 'AAPL',
    action: 'buy',
    price: 100,
    source: 'tests',
    receivedAt: now,
    ...overrides,
  };
}

// Inside the default 09:30–16:00 window in New York.
const NOW = new Date('2026-08-31T18:00:00Z');

function context(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    killSwitch: false,
    riskRules: rules({}),
    connections: [connection],
    positions: [],
    ordersToday: 0,
    realizedPnlToday: 0,
    consecutiveLosses: 0,
    now: NOW,
    timeZone: 'America/New_York',
    ...overrides,
  };
}

function position(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos-1',
    ticker: 'AAPL',
    connectionName: connection.name,
    qty: 100,
    side: 'long',
    avgPrice: 400,
    currentPrice: 400,
    marketValue: 40_000,
    pnl: 0,
    pnlPercent: 0,
    ...overrides,
  };
}

export function riskRuleTests(check: Check): void {
  // risk-002 — maximum quantity per order.
  check(
    'risk-002 refuse une quantité au-dessus du plafond',
    evaluateRisk(context({ riskRules: rules({ 'risk-002': '50' }) }), strategy, subscription, signal(), 60, 100)
      .reason?.includes('Quantité 60') === true
  );
  check(
    'risk-002 laisse passer sous le plafond',
    evaluateRisk(context({ riskRules: rules({ 'risk-002': '50' }) }), strategy, subscription, signal(), 40, 100).allowed
  );
  check(
    'risk-002 désactivée est ignorée',
    evaluateRisk(context(), strategy, subscription, signal(), 60, 100).allowed
  );

  // risk-003 — exposure per instrument.
  check(
    'risk-003 refuse au-delà de l’exposition par ticker',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-003': '50 000 $' }), positions: [position()] }),
      strategy,
      subscription,
      signal(),
      200,
      100
    ).reason?.includes('Exposition sur AAPL') === true
  );

  // risk-004 — exposure per account.
  check(
    'risk-004 refuse au-delà de l’exposition du compte',
    evaluateRisk(
      context({
        riskRules: rules({ 'risk-004': '50 000 $' }),
        positions: [position({ ticker: 'MSFT' })],
      }),
      strategy,
      subscription,
      signal(),
      200,
      100
    ).reason?.includes('Exposition du compte') === true
  );

  // risk-005 — daily order quota.
  check(
    'risk-005 refuse au-delà du quota journalier',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-005': '50' }), ordersToday: 50 }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).reason?.includes('Quota d’ordres journalier') === true
  );
  check(
    'risk-005 laisse passer sous le quota',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-005': '50' }), ordersToday: 49 }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).allowed
  );

  // risk-006 — daily loss limit.
  check(
    'risk-006 refuse quand la perte du jour atteint la limite',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-006': '3 000 $' }), realizedPnlToday: -3200 }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).reason?.includes('Perte journalière maximale') === true
  );
  check(
    'risk-006 ignore un gain du jour',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-006': '3 000 $' }), realizedPnlToday: 5000 }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).allowed
  );

  // risk-007 — consecutive losses.
  check(
    'risk-007 refuse après N pertes consécutives',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-007': '5' }), consecutiveLosses: 5 }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).reason?.includes('pertes consécutives') === true
  );

  // risk-008 — mandatory stop-loss.
  const crypto = { ...strategy, assetClass: 'crypto' as const };
  check(
    'risk-008 refuse un signal crypto sans stop-loss',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-008': true }) }),
      crypto,
      subscription,
      signal(),
      10,
      100
    ).reason?.includes('Stop-loss obligatoire') === true
  );
  check(
    'risk-008 accepte avec stop-loss',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-008': true }) }),
      crypto,
      subscription,
      signal({ stopLoss: 95 }),
      10,
      100
    ).allowed
  );
  check(
    'risk-008 n’affecte pas les actions',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-008': true }) }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).allowed
  );

  // risk-009 — forced manual validation.
  const large = evaluateRisk(
    context({ riskRules: rules({ 'risk-009': '10 000 $' }) }),
    strategy,
    subscription,
    signal(),
    200,
    100
  );
  check('risk-009 impose la validation manuelle au-delà du seuil', large.allowed && large.requireManualValidation);
  const small = evaluateRisk(
    context({ riskRules: rules({ 'risk-009': '10 000 $' }) }),
    strategy,
    subscription,
    signal(),
    10,
    100
  );
  check('risk-009 laisse passer sous le seuil', small.allowed && !small.requireManualValidation);

  // risk-010 — trading hours.
  check(
    'risk-010 refuse hors plage horaire',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-010': '09:30–16:00 ET' }), now: new Date('2026-08-31T02:00:00Z') }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).reason?.includes('plage horaire') === true
  );
  check(
    'risk-010 accepte dans la plage horaire',
    evaluateRisk(
      context({ riskRules: rules({ 'risk-010': '09:30–16:00 ET' }) }),
      strategy,
      subscription,
      signal(),
      10,
      100
    ).allowed
  );

  // Signal staleness now uses the declared emission time.
  check(
    'délai maximal du signal appliqué via timestamp',
    evaluateRisk(
      context(),
      strategy,
      subscription,
      signal({ emittedAt: new Date(NOW.getTime() - 600_000).toISOString() }),
      10,
      100
    ).reason?.includes('Signal expiré') === true
  );
  check(
    'signal récent accepté',
    evaluateRisk(
      context(),
      strategy,
      subscription,
      signal({ emittedAt: new Date(NOW.getTime() - 5_000).toISOString() }),
      10,
      100
    ).allowed
  );
}
