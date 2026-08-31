import { getDb } from './pool';
import { migrate } from './migrate';
import { encrypt, newWebhookSecret } from '../lib/crypto';

const riskRules = [
  ['risk-001', 'Montant maximal par ordre', 'Aucun ordre ne peut dépasser ce montant en valeur.', '25 000 $', true, false],
  ['risk-002', 'Quantité maximale par ordre', 'Nombre maximum d’unités par ordre individuel.', '500', true, false],
  ['risk-003', 'Position maximale par ticker', 'Exposition maximale sur un seul instrument.', '50 000 $', true, false],
  ['risk-004', 'Exposition maximale par compte', 'Valeur totale maximale des positions ouvertes par compte.', '100 000 $', true, true],
  ['risk-005', 'Ordres par jour', 'Nombre maximal d’ordres soumis par jour calendaire.', '50', true, false],
  ['risk-006', 'Perte journalière maximale', 'Suspend automatiquement les stratégies en mode réel si atteinte.', '3 000 $', true, false],
  ['risk-007', 'Pertes consécutives maximales', 'Suspend les souscriptions après ce nombre de pertes d’affilée.', '5', false, false],
  ['risk-008', 'Stop-loss obligatoire', 'Exige un stop-loss sur les stratégies futures et crypto.', 'Activé (futures, crypto)', true, false],
  ['risk-009', 'Validation manuelle au-delà de', 'Les ordres dépassant ce montant nécessitent une approbation manuelle.', '10 000 $', true, false],
  ['risk-010', 'Plage horaire autorisée', 'Refuse les ordres en dehors des heures de marché configurées.', '09:30–16:00 ET', true, false],
] as const;

const strategies = [
  {
    id: 'strat-001',
    name: 'MACD Swing',
    description: 'Stratégie de swing trading basée sur les croisements MACD et confirmation de tendance.',
    status: 'active',
    assetClass: 'actions',
    allowedActions: ['buy', 'sell', 'exit'],
    whitelist: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'],
    blacklist: [] as string[],
    webhookId: 'wd_8f3a2b1c',
    maxSignalDelaySec: 30,
    rejectDuplicates: true,
    maxVolume: 500,
    maxExposure: 100000,
    defaultOrderType: 'market',
  },
  {
    id: 'strat-002',
    name: 'RSI Reversal Crypto',
    description: 'Reversal sur conditions de survente/surachat RSI sur paires crypto majeures.',
    status: 'active',
    assetClass: 'crypto',
    allowedActions: ['buy', 'sell', 'reverse'],
    whitelist: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD'],
    blacklist: [] as string[],
    webhookId: 'wd_2c4d6e8f',
    maxSignalDelaySec: 15,
    rejectDuplicates: true,
    maxVolume: 2,
    maxExposure: 50000,
    defaultOrderType: 'limit',
  },
  {
    id: 'strat-003',
    name: 'Futures Breakout',
    description: 'Breakout sur contrats futures ES et NQ avec filtre de volatilité.',
    status: 'suspendue',
    assetClass: 'futures',
    allowedActions: ['buy', 'sell', 'short', 'cover'],
    whitelist: ['ES', 'NQ', 'CL', 'GC'],
    blacklist: [] as string[],
    webhookId: 'wd_9a0b1c2d',
    maxSignalDelaySec: 10,
    rejectDuplicates: true,
    maxVolume: 10,
    maxExposure: 75000,
    defaultOrderType: 'stop',
  },
  {
    id: 'strat-004',
    name: 'ETF Rotation Mensuelle',
    description: 'Rotation sectorielle mensuelle entre ETF SPDR avec signal de momentum.',
    status: 'brouillon',
    assetClass: 'etf',
    allowedActions: ['buy', 'sell', 'exit'],
    whitelist: ['SPY', 'QQQ', 'IWM', 'XLK', 'XLF', 'XLE'],
    blacklist: [] as string[],
    webhookId: 'wd_5e6f7a8b',
    maxSignalDelaySec: 120,
    rejectDuplicates: false,
    maxVolume: 1000,
    maxExposure: 200000,
    defaultOrderType: 'market',
  },
];

const connections = [
  {
    id: 'conn-001',
    name: 'Alpaca Paper Principal',
    broker: 'Alpaca',
    env: 'simulation',
    status: 'actif',
    currency: 'USD',
    buyingPower: 180000,
    equity: 102450,
    allowedInstruments: ['actions', 'etf'],
  },
  {
    id: 'conn-002',
    name: 'Binance Spot',
    broker: 'Binance',
    env: 'reel',
    status: 'actif',
    currency: 'USDT',
    buyingPower: 24500,
    equity: 24500,
    allowedInstruments: ['crypto'],
  },
  {
    id: 'conn-003',
    name: 'Interactive Brokers Demo',
    broker: 'Interactive Brokers',
    env: 'demonstration',
    status: 'actif',
    currency: 'USD',
    buyingPower: 500000,
    equity: 251000,
    allowedInstruments: ['actions', 'etf', 'futures', 'options'],
  },
  {
    id: 'conn-004',
    name: 'Tradier Live',
    broker: 'Tradier',
    env: 'reel',
    status: 'expire',
    currency: 'USD',
    buyingPower: 0,
    equity: 18200,
    allowedInstruments: ['actions', 'options'],
  },
];

const subscriptions = [
  ['sub-001', 'strat-001', 'conn-001', true, 'automatique', 'quantite_fixe', 10, 100, 50000, false, null],
  ['sub-002', 'strat-001', 'conn-003', true, 'validation_manuelle', 'pourcentage_capital', 2, 200, 80000, false, null],
  ['sub-003', 'strat-002', 'conn-002', true, 'automatique', 'montant_monetaire', 2000, 5, 20000, false, null],
  ['sub-004', 'strat-003', 'conn-003', false, 'simulation', 'quantite_fixe', 2, 10, 60000, true, null],
] as const;

export async function seed(): Promise<void> {
  await migrate();
  const db = getDb();

  await db.query(`INSERT INTO settings (key, value) VALUES ('kill_switch', 'false')
                  ON CONFLICT (key) DO NOTHING`);

  for (let i = 0; i < riskRules.length; i += 1) {
    const [id, label, description, value, enabled, triggered] = riskRules[i];
    await db.query(
      `INSERT INTO risk_rules (id, label, description, value, enabled, triggered, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [id, label, description, value, enabled, triggered, i]
    );
  }

  for (const s of strategies) {
    await db.query(
      `INSERT INTO strategies
        (id, name, description, status, asset_class, allowed_actions, whitelist, blacklist,
         webhook_id, webhook_secret, max_signal_delay_sec, reject_duplicates, max_volume,
         max_exposure, default_order_type, signals_today, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0, now())
       ON CONFLICT (id) DO NOTHING`,
      [
        s.id,
        s.name,
        s.description,
        s.status,
        s.assetClass,
        JSON.stringify(s.allowedActions),
        JSON.stringify(s.whitelist),
        JSON.stringify(s.blacklist),
        s.webhookId,
        newWebhookSecret(),
        s.maxSignalDelaySec,
        s.rejectDuplicates,
        s.maxVolume,
        s.maxExposure,
        s.defaultOrderType,
      ]
    );
  }

  for (const c of connections) {
    await db.query(
      `INSERT INTO connections
        (id, name, broker, env, status, currency, buying_power, equity, allowed_instruments,
         api_key_cipher, api_secret_cipher, last_test_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id,
        c.name,
        c.broker,
        c.env,
        c.status,
        c.currency,
        c.buyingPower,
        c.equity,
        JSON.stringify(c.allowedInstruments),
        encrypt('demo-api-key'),
        encrypt('demo-api-secret'),
      ]
    );
  }

  for (const s of subscriptions) {
    await db.query(
      `INSERT INTO subscriptions
        (id, strategy_id, connection_id, enabled, execution_mode, sizing_method,
         sizing_value, max_order_size, max_exposure, allow_short, ticker_override)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [...s]
    );
  }
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('[db] données de démarrage insérées.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[db] échec du seed:', err);
      process.exit(1);
    });
}
