-- =====================================================================
-- SignalDesk — données de démonstration pour Supabase
-- À exécuter APRÈS supabase-setup.sql, dans Supabase SQL Editor.
--
-- Ce script est idempotent : il n'écrase pas les données existantes.
-- Les connexions ajoutées sont simulées et ne contiennent aucune clé API.
-- Chaque secret webhook est généré une seule fois ; copiez-le depuis
-- SignalDesk ou régénérez-le dans l'interface avant une intégration réelle.
-- =====================================================================

begin;

insert into public.settings (key, value)
values ('kill_switch', 'false')
on conflict (key) do nothing;

insert into public.risk_rules (id, label, description, value, enabled, triggered, position)
values
  ('risk-001', 'Montant maximal par ordre', 'Aucun ordre ne peut dépasser ce montant en valeur.', '25 000 $', true, false, 0),
  ('risk-002', 'Quantité maximale par ordre', 'Nombre maximum d''unités par ordre individuel.', '500', true, false, 1),
  ('risk-003', 'Position maximale par ticker', 'Exposition maximale sur un seul instrument.', '50 000 $', true, false, 2),
  ('risk-004', 'Exposition maximale par compte', 'Valeur totale maximale des positions ouvertes par compte.', '100 000 $', true, true, 3),
  ('risk-005', 'Ordres par jour', 'Nombre maximal d''ordres soumis par jour calendaire.', '50', true, false, 4),
  ('risk-006', 'Perte journalière maximale', 'Suspend automatiquement les stratégies en mode réel si atteinte.', '3 000 $', true, false, 5),
  ('risk-007', 'Pertes consécutives maximales', 'Suspend les souscriptions après ce nombre de pertes d''affilée.', '5', false, false, 6),
  ('risk-008', 'Stop-loss obligatoire', 'Exige un stop-loss sur les stratégies futures et crypto.', 'Activé (futures, crypto)', true, false, 7),
  ('risk-009', 'Validation manuelle au-delà de', 'Les ordres dépassant ce montant nécessitent une approbation manuelle.', '10 000 $', true, false, 8),
  ('risk-010', 'Plage horaire autorisée', 'Refuse les ordres en dehors des heures de marché configurées.', '09:30–16:00 ET', true, false, 9)
on conflict (id) do nothing;

insert into public.strategies (
  id, name, description, status, asset_class, allowed_actions, whitelist, blacklist,
  webhook_id, webhook_secret, max_signal_delay_sec, reject_duplicates, max_volume,
  max_exposure, default_order_type, signals_today, created_at
)
values
  (
    'strat-001',
    'MACD Swing',
    'Stratégie de swing trading basée sur les croisements MACD et confirmation de tendance.',
    'active', 'actions', '["buy", "sell", "exit"]'::jsonb,
    '["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META"]'::jsonb, '[]'::jsonb,
    'wd_8f3a2b1c',
    'whsec_' || md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    30, true, 500, 100000, 'market', 0, now()
  ),
  (
    'strat-002',
    'RSI Reversal Crypto',
    'Reversal sur conditions de survente/surachat RSI sur paires crypto majeures.',
    'active', 'crypto', '["buy", "sell", "reverse"]'::jsonb,
    '["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD"]'::jsonb, '[]'::jsonb,
    'wd_2c4d6e8f',
    'whsec_' || md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    15, true, 2, 50000, 'limit', 0, now()
  ),
  (
    'strat-003',
    'Futures Breakout',
    'Breakout sur contrats futures ES et NQ avec filtre de volatilité.',
    'suspendue', 'futures', '["buy", "sell", "short", "cover"]'::jsonb,
    '["ES", "NQ", "CL", "GC"]'::jsonb, '[]'::jsonb,
    'wd_9a0b1c2d',
    'whsec_' || md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    10, true, 10, 75000, 'stop', 0, now()
  ),
  (
    'strat-004',
    'ETF Rotation Mensuelle',
    'Rotation sectorielle mensuelle entre ETF SPDR avec signal de momentum.',
    'brouillon', 'etf', '["buy", "sell", "exit"]'::jsonb,
    '["SPY", "QQQ", "IWM", "XLK", "XLF", "XLE"]'::jsonb, '[]'::jsonb,
    'wd_5e6f7a8b',
    'whsec_' || md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    120, false, 1000, 200000, 'market', 0, now()
  )
on conflict (id) do nothing;

insert into public.connections (
  id, name, broker, env, status, currency, buying_power, equity, allowed_instruments,
  api_key_cipher, api_secret_cipher, last_test_at
)
values
  (
    'conn-001', 'Alpaca Paper Principal', 'Alpaca', 'simulation', 'actif', 'USD',
    180000, 102450, '["actions", "etf"]'::jsonb, null, null, now()
  ),
  (
    'conn-002', 'Binance Spot', 'Binance', 'reel', 'actif', 'USDT',
    24500, 24500, '["crypto"]'::jsonb, null, null, now()
  ),
  (
    'conn-003', 'Interactive Brokers Demo', 'Interactive Brokers', 'demonstration', 'actif', 'USD',
    500000, 251000, '["actions", "etf", "futures", "options"]'::jsonb, null, null, now()
  ),
  (
    'conn-004', 'Tradier Live', 'Tradier', 'reel', 'expire', 'USD',
    0, 18200, '["actions", "options"]'::jsonb, null, null, now()
  )
on conflict (id) do nothing;

insert into public.subscriptions (
  id, strategy_id, connection_id, enabled, execution_mode, sizing_method,
  sizing_value, max_order_size, max_exposure, allow_short, ticker_override
)
values
  ('sub-001', 'strat-001', 'conn-001', true, 'automatique', 'quantite_fixe', 10, 100, 50000, false, null),
  ('sub-002', 'strat-001', 'conn-003', true, 'validation_manuelle', 'pourcentage_capital', 2, 200, 80000, false, null),
  ('sub-003', 'strat-002', 'conn-002', true, 'automatique', 'montant_monetaire', 2000, 5, 20000, false, null),
  ('sub-004', 'strat-003', 'conn-003', false, 'simulation', 'quantite_fixe', 2, 10, 60000, true, null)
on conflict (id) do nothing;

commit;

-- Vérification rapide après exécution.
select
  (select count(*) from public.strategies) as strategies,
  (select count(*) from public.connections) as connections,
  (select count(*) from public.subscriptions) as subscriptions,
  (select count(*) from public.risk_rules) as risk_rules;
