-- =====================================================================
-- SignalDesk — script d'initialisation PostgreSQL / Supabase
-- Généré par : npm run db:script
-- Ne pas modifier à la main : éditez apps/api/src/db/schema.sql ou rls.sql.
--
-- Utilisation (Supabase) : SQL Editor > New query > coller > Run.
-- Puis, pour insérer les données de démarrage :
--   DATABASE_URL="postgresql://..." DATABASE_SSL=true npm run db:seed
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text,
  google_id     text UNIQUE,
  role          text NOT NULL DEFAULT 'operateur',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS strategies (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  description          text NOT NULL DEFAULT '',
  status               text NOT NULL,
  asset_class          text NOT NULL,
  allowed_actions      jsonb NOT NULL DEFAULT '[]',
  whitelist            jsonb NOT NULL DEFAULT '[]',
  blacklist            jsonb NOT NULL DEFAULT '[]',
  webhook_id           text NOT NULL UNIQUE,
  webhook_secret       text NOT NULL,
  max_signal_delay_sec integer NOT NULL DEFAULT 30,
  reject_duplicates    boolean NOT NULL DEFAULT true,
  max_volume           double precision NOT NULL DEFAULT 0,
  max_exposure         double precision NOT NULL DEFAULT 0,
  default_order_type   text NOT NULL DEFAULT 'market',
  signals_today        integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS connections (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  broker              text NOT NULL,
  env                 text NOT NULL,
  status              text NOT NULL,
  currency            text NOT NULL DEFAULT 'USD',
  buying_power        double precision NOT NULL DEFAULT 0,
  equity              double precision NOT NULL DEFAULT 0,
  allowed_instruments jsonb NOT NULL DEFAULT '[]',
  api_key_cipher      text,
  api_secret_cipher   text,
  last_test_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              text PRIMARY KEY,
  strategy_id     text NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  connection_id   text NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  enabled         boolean NOT NULL DEFAULT true,
  execution_mode  text NOT NULL,
  sizing_method   text NOT NULL,
  sizing_value    double precision NOT NULL,
  max_order_size  double precision NOT NULL,
  max_exposure    double precision NOT NULL,
  allow_short     boolean NOT NULL DEFAULT false,
  ticker_override text
);

CREATE TABLE IF NOT EXISTS orders (
  id               text PRIMARY KEY,
  signal_id        text NOT NULL,
  ticker           text NOT NULL,
  action           text NOT NULL,
  side             text NOT NULL,
  quantity         double precision NOT NULL,
  order_type       text NOT NULL,
  limit_price      double precision,
  stop_price       double precision,
  time_in_force    text NOT NULL DEFAULT 'day',
  status           text NOT NULL,
  strategy_id      text,
  strategy_name    text NOT NULL,
  connection_id    text,
  connection_name  text NOT NULL,
  broker_order_id  text,
  filled_qty       double precision NOT NULL DEFAULT 0,
  avg_fill_price   double precision,
  rejection_reason text,
  received_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz,
  executed_at      timestamptz,
  execution_venue  text NOT NULL DEFAULT 'simulation'
);

CREATE TABLE IF NOT EXISTS realized_trades (
  id              text PRIMARY KEY,
  ticker          text NOT NULL,
  connection_name text NOT NULL,
  quantity        double precision NOT NULL,
  pnl             double precision NOT NULL,
  closed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signal_logs (
  id                     text PRIMARY KEY,
  signal_id              text NOT NULL,
  ticker                 text NOT NULL,
  action                 text NOT NULL,
  strategy_name          text NOT NULL,
  source                 text NOT NULL,
  status                 text NOT NULL,
  reason                 text,
  subscriptions_targeted integer NOT NULL DEFAULT 0,
  received_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
  id              text PRIMARY KEY,
  ticker          text NOT NULL,
  connection_name text NOT NULL,
  qty             double precision NOT NULL,
  side            text NOT NULL,
  avg_price       double precision NOT NULL,
  current_price   double precision NOT NULL,
  market_value    double precision NOT NULL,
  pnl             double precision NOT NULL DEFAULT 0,
  pnl_percent     double precision NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS risk_rules (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  description text NOT NULL DEFAULT '',
  value       text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  triggered   boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id        text PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  actor     text NOT NULL,
  action    text NOT NULL,
  target    text NOT NULL,
  ip        text NOT NULL DEFAULT '-',
  severity  text NOT NULL DEFAULT 'info'
);

CREATE TABLE IF NOT EXISTS notifications (
  id        text PRIMARY KEY,
  type      text NOT NULL,
  title     text NOT NULL,
  message   text NOT NULL,
  severity  text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  read      boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_signals (
  signal_id   text NOT NULL,
  strategy_id text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, strategy_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_received_at ON orders (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_logs_received_at ON signal_logs (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_strategy ON subscriptions (strategy_id);
CREATE INDEX IF NOT EXISTS idx_realized_trades_closed_at ON realized_trades (closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- Durcissement destiné à Supabase.
-- L'API se connecte avec le rôle propriétaire (postgres) et n'est donc pas
-- soumise à RLS. Aucune policy n'est créée : les clés anon / authenticated
-- exposées côté navigateur via PostgREST ne peuvent lire ni écrire ces tables.

ALTER TABLE public.strategies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realized_trades   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions          ENABLE ROW LEVEL SECURITY;

-- Retire aussi les privilèges par défaut accordés par Supabase aux rôles publics.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END
$$;

COMMENT ON COLUMN public.strategies.webhook_secret IS
  'Secret HMAC du webhook : ne doit jamais être exposé publiquement.';
COMMENT ON COLUMN public.users.password_hash IS
  'Empreinte scrypt du mot de passe : jamais exposée par l''API.';
COMMENT ON COLUMN public.sessions.token_hash IS
  'Empreinte SHA-256 du jeton de session : le jeton brut ne vit que dans le cookie.';
COMMENT ON COLUMN public.connections.api_key_cipher IS
  'Clé API courtier chiffrée en AES-256-GCM par l''API.';
COMMENT ON COLUMN public.connections.api_secret_cipher IS
  'Secret API courtier chiffré en AES-256-GCM par l''API.';
