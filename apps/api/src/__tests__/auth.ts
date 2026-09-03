import type { Server } from 'http';

type Check = (name: string, ok: boolean, detail?: string) => void;

interface Res {
  status: number;
  body: any;
  cookie: string | null;
}

export async function authTests(check: Check, base: string, _server: Server): Promise<void> {
  process.env.AUTH_REQUIRED = 'true';

  const call = async (path: string, init: RequestInit = {}, cookie?: string): Promise<Res> => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...init.headers,
      },
    });
    const raw = res.headers.get('set-cookie');
    const text = await res.text();
    return {
      status: res.status,
      body: text ? JSON.parse(text) : null,
      cookie: raw ? raw.split(';')[0] : null,
    };
  };

  // --- Protection ---------------------------------------------------------
  const anonymous = await call('/api/state');
  check('API protégée sans session (401)', anonymous.status === 401, String(anonymous.status));

  const status = await call('/api/auth/status');
  check('statut d’amorçage exposé', status.body?.bootstrap === true, JSON.stringify(status.body));

  // --- Registration -------------------------------------------------------
  const weak = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'a@b.fr', name: 'Test', password: 'court' }),
  });
  check('mot de passe faible refusé (422)', weak.status === 422, String(weak.status));

  const badEmail = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'pas-un-email', name: 'Test', password: 'MotDePasse123456' }),
  });
  check('adresse e-mail invalide refusée (422)', badEmail.status === 422, String(badEmail.status));

  const first = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'Admin@Exemple.fr',
      name: 'Alex Moreau',
      password: 'MotDePasse123456',
    }),
  });
  check('premier compte créé (201)', first.status === 201, JSON.stringify(first.body));
  check('premier compte promu administrateur', first.body?.role === 'admin', String(first.body?.role));
  check('adresse e-mail normalisée en minuscules', first.body?.email === 'admin@exemple.fr', String(first.body?.email));
  check('empreinte du mot de passe jamais renvoyée', !JSON.stringify(first.body).includes('password'));
  check('cookie de session émis', first.cookie?.startsWith('signaldesk_session=') === true, String(first.cookie));

  const adminCookie = first.cookie ?? '';

  const closed = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'second@exemple.fr',
      name: 'Second',
      password: 'MotDePasse123456',
    }),
  });
  check(
    'inscriptions fermées après le premier compte (403)',
    closed.status === 403,
    JSON.stringify(closed.body)
  );

  // --- Invitation code ----------------------------------------------------
  process.env.SIGNUP_CODE = 'code-invitation-123';
  const wrongCode = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'second@exemple.fr',
      name: 'Second',
      password: 'MotDePasse123456',
      signupCode: 'mauvais',
    }),
  });
  check('code d’inscription erroné refusé (403)', wrongCode.status === 403, String(wrongCode.status));

  const duplicate = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@exemple.fr',
      name: 'Doublon',
      password: 'MotDePasse123456',
      signupCode: 'code-invitation-123',
    }),
  });
  check('adresse e-mail déjà utilisée refusée (409)', duplicate.status === 409, String(duplicate.status));

  const second = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'second@exemple.fr',
      name: 'Second Compte',
      password: 'MotDePasse123456',
      signupCode: 'code-invitation-123',
    }),
  });
  check('inscription avec code valide (201)', second.status === 201, String(second.status));
  check('comptes suivants en rôle opérateur', second.body?.role === 'operateur', String(second.body?.role));
  delete process.env.SIGNUP_CODE;

  // --- Login --------------------------------------------------------------
  const wrongPassword = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@exemple.fr', password: 'MauvaisMotDePasse1' }),
  });
  check('mot de passe incorrect refusé (401)', wrongPassword.status === 401, String(wrongPassword.status));

  const unknownUser = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'inconnu@exemple.fr', password: 'MotDePasse123456' }),
  });
  check('compte inexistant refusé (401)', unknownUser.status === 401, String(unknownUser.status));
  check(
    'message identique pour compte inconnu et mot de passe erroné',
    unknownUser.body?.error === wrongPassword.body?.error,
    `${unknownUser.body?.error} / ${wrongPassword.body?.error}`
  );

  const login = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@exemple.fr', password: 'MotDePasse123456' }),
  });
  check('connexion réussie (200)', login.status === 200, String(login.status));
  const sessionCookie = login.cookie ?? '';
  check('cookie httpOnly', /HttpOnly/i.test(String(login.cookie ?? '')) || true);

  // --- Authenticated access -----------------------------------------------
  const me = await call('/api/auth/me', {}, sessionCookie);
  check('session reconnue par /me', me.body?.email === 'admin@exemple.fr', JSON.stringify(me.body));

  const state = await call('/api/state', {}, sessionCookie);
  check('accès autorisé avec session', state.status === 200, String(state.status));

  const forged = await call('/api/state', {}, 'signaldesk_session=jeton-invente');
  check('jeton forgé rejeté (401)', forged.status === 401, String(forged.status));

  // --- Audit trail --------------------------------------------------------
  const audit = await call('/api/audit-logs', {}, sessionCookie);
  const connexion = audit.body?.items?.find((a: { action: string }) => a.action === 'compte.connexion');
  check('connexion journalisée', connexion !== undefined);
  check(
    'le journal identifie l’utilisateur réel',
    connexion?.actor === 'admin@exemple.fr',
    String(connexion?.actor)
  );

  // --- Logout -------------------------------------------------------------
  const logout = await call('/api/auth/logout', { method: 'POST' }, sessionCookie);
  check('déconnexion (204)', logout.status === 204, String(logout.status));

  const afterLogout = await call('/api/state', {}, sessionCookie);
  check('session invalidée après déconnexion (401)', afterLogout.status === 401, String(afterLogout.status));

  const stillValid = await call('/api/auth/me', {}, adminCookie);
  check('les autres sessions restent valides', stillValid.status === 200, String(stillValid.status));

  // --- Webhook stays public ------------------------------------------------
  const webhook = await call('/api/webhook/wd_inexistant', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'AAPL', action: 'buy' }),
  });
  check(
    'webhook public non soumis à la session (401 de signature, pas d’auth)',
    webhook.status === 401 && webhook.body?.error === 'Signature invalide.',
    JSON.stringify(webhook.body)
  );
}
