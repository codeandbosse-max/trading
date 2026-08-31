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
