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
