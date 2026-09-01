import { createServer, type Server } from 'http';
import { readIdToken } from '../services/google';

type Check = (name: string, ok: boolean, detail?: string) => void;

const CLIENT_ID = 'client-test.apps.googleusercontent.com';

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Builds an id_token shaped like Google's, without a real signature. */
function idToken(claims: Record<string, unknown>): string {
  const payload = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: '1234567890',
    email: 'utilisateur@exemple.fr',
    email_verified: true,
    name: 'Utilisateur Google',
    ...claims,
  };
  return `${base64url({ alg: 'RS256' })}.${base64url(payload)}.signature`;
}

interface TokenRequest {
  body: string;
}

function startFakeGoogle(
  requests: TokenRequest[],
  tokenFor: () => { status: number; body: unknown }
): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      requests.push({ body });
      const { status, body: payload } = tokenFor();
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
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

export async function googleTests(check: Check, base: string): Promise<void> {
  // --- Disabled by default ------------------------------------------------
  const disabled = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
  check('connexion Google indisponible sans configuration (503)', disabled.status === 503, String(disabled.status));

  const statusOff = await (await fetch(`${base}/api/auth/status`)).json();
  check('statut annonce Google désactivé', statusOff.googleEnabled === false);

  // --- Configure against the fake provider --------------------------------
  const requests: TokenRequest[] = [];
  let tokenResponse: { status: number; body: unknown } = {
    status: 200,
    body: { id_token: idToken({}) },
  };
  const { server, url } = await startFakeGoogle(requests, () => tokenResponse);

  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = 'secret-google-test';
  process.env.GOOGLE_REDIRECT_URI = `${base}/api/auth/google/callback`;
  process.env.GOOGLE_AUTH_URL = `${url}/consent`;
  process.env.GOOGLE_TOKEN_URL = `${url}/token`;
  process.env.WEB_URL = 'http://localhost:3000';

  const statusOn = await (await fetch(`${base}/api/auth/status`)).json();
  check('statut annonce Google activé', statusOn.googleEnabled === true);

  // An account already exists, so creating one through Google needs the invitation code.
  process.env.SIGNUP_CODE = 'code-google-test';

  // --- Authorization redirect ---------------------------------------------
  const start = await fetch(`${base}/api/auth/google?signupCode=code-google-test`, {
    redirect: 'manual',
  });
  check('redirection vers Google (302)', start.status === 302, String(start.status));

  const location = new URL(start.headers.get('location') ?? '');
  check('client_id transmis', location.searchParams.get('client_id') === CLIENT_ID);
  check('scope openid demandé', location.searchParams.get('scope')?.includes('openid') === true);
  check('response_type=code', location.searchParams.get('response_type') === 'code');
  const state = location.searchParams.get('state') ?? '';
  check('state anti-CSRF généré', state.length >= 32, String(state.length));

  const oauthCookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
  check('state conservé dans un cookie', oauthCookie.startsWith('signaldesk_oauth='), oauthCookie);

  // --- CSRF protection -----------------------------------------------------
  const forged = await fetch(
    `${base}/api/auth/google/callback?code=abc&state=state-invente`,
    { redirect: 'manual', headers: { cookie: oauthCookie } }
  );
  check('state divergent rejeté', forged.status === 302, String(forged.status));
  check(
    'redirection vers /login avec erreur',
    (forged.headers.get('location') ?? '').includes('/login?error='),
    String(forged.headers.get('location'))
  );

  const noCookie = await fetch(`${base}/api/auth/google/callback?code=abc&state=${state}`, {
    redirect: 'manual',
  });
  check(
    'callback sans cookie rejeté',
    (noCookie.headers.get('location') ?? '').includes('/login?error='),
    String(noCookie.headers.get('location'))
  );

  // --- Successful sign-in ---------------------------------------------------
  const success = await fetch(`${base}/api/auth/google/callback?code=code-valide&state=${state}`, {
    redirect: 'manual',
    headers: { cookie: oauthCookie },
  });
  check(
    'connexion Google aboutit sur le tableau de bord',
    (success.headers.get('location') ?? '').endsWith('/dashboard'),
    String(success.headers.get('location'))
  );

  const sent = new URLSearchParams(requests.at(-1)?.body ?? '');
  check('code d’autorisation échangé', sent.get('code') === 'code-valide', String(sent.get('code')));
  check('grant_type conforme', sent.get('grant_type') === 'authorization_code');
  check('secret client transmis au seul serveur Google', sent.get('client_secret') === 'secret-google-test');

  const sessionCookie = (success.headers.get('set-cookie') ?? '')
    .split(',')
    .map((c) => c.trim())
    .find((c) => c.startsWith('signaldesk_session='));
  check('session ouverte après Google', Boolean(sessionCookie), String(success.headers.get('set-cookie')));

  const me = await (
    await fetch(`${base}/api/auth/me`, { headers: { cookie: sessionCookie ?? '' } })
  ).json();
  check('compte Google reconnu', me?.email === 'utilisateur@exemple.fr', JSON.stringify(me));
  check('compte Google créé en rôle opérateur', me?.role === 'operateur', String(me?.role));

  // --- Second sign-in reuses the same account -------------------------------
  const start2 = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
  const state2 = new URL(start2.headers.get('location') ?? '').searchParams.get('state') ?? '';
  const cookie2 = (start2.headers.get('set-cookie') ?? '').split(';')[0];
  const again = await fetch(`${base}/api/auth/google/callback?code=code2&state=${state2}`, {
    redirect: 'manual',
    headers: { cookie: cookie2 },
  });
  check(
    'seconde connexion Google acceptée',
    (again.headers.get('location') ?? '').endsWith('/dashboard'),
    String(again.headers.get('location'))
  );

  const users = await (
    await fetch(`${base}/api/auth/me`, {
      headers: {
        cookie:
          (again.headers.get('set-cookie') ?? '')
            .split(',')
            .map((c) => c.trim())
            .find((c) => c.startsWith('signaldesk_session=')) ?? '',
      },
    })
  ).json();
  check('aucun doublon de compte', users?.email === 'utilisateur@exemple.fr', JSON.stringify(users));

  // --- Rejected profiles ----------------------------------------------------
  const scenarios: { name: string; body: unknown; status?: number }[] = [
    { name: 'adresse non vérifiée refusée', body: { id_token: idToken({ email_verified: false, sub: '999' }) } },
    { name: 'audience étrangère refusée', body: { id_token: idToken({ aud: 'autre-client', sub: '998' }) } },
    { name: 'émetteur inattendu refusé', body: { id_token: idToken({ iss: 'https://evil.example', sub: '997' }) } },
    { name: 'jeton expiré refusé', body: { id_token: idToken({ exp: 1, sub: '996' }) } },
    { name: 'échec côté Google refusé', body: { error: 'invalid_grant' }, status: 400 },
  ];

  for (const scenario of scenarios) {
    tokenResponse = { status: scenario.status ?? 200, body: scenario.body };
    const s = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
    const st = new URL(s.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const ck = (s.headers.get('set-cookie') ?? '').split(';')[0];
    const res = await fetch(`${base}/api/auth/google/callback?code=x&state=${st}`, {
      redirect: 'manual',
      headers: { cookie: ck },
    });
    const target = res.headers.get('location') ?? '';
    check(scenario.name, target.includes('/login?error='), target);
  }

  // --- Domain restriction ---------------------------------------------------
  process.env.GOOGLE_ALLOWED_DOMAIN = 'exemple.fr';
  tokenResponse = { status: 200, body: { id_token: idToken({ sub: '555', hd: 'autre.fr' }) } };
  const s3 = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
  const st3 = new URL(s3.headers.get('location') ?? '').searchParams.get('state') ?? '';
  const ck3 = (s3.headers.get('set-cookie') ?? '').split(';')[0];
  const wrongDomain = await fetch(`${base}/api/auth/google/callback?code=x&state=${st3}`, {
    redirect: 'manual',
    headers: { cookie: ck3 },
  });
  check(
    'domaine Google non autorisé refusé',
    (wrongDomain.headers.get('location') ?? '').includes('/login?error='),
    String(wrongDomain.headers.get('location'))
  );
  delete process.env.GOOGLE_ALLOWED_DOMAIN;

  // --- Token reader unit checks --------------------------------------------
  const profile = readIdToken(idToken({ hd: 'exemple.fr' }));
  check('lecture du profil Google', profile.email === 'utilisateur@exemple.fr' && profile.googleId === '1234567890');
  check('domaine hébergé extrait', profile.hostedDomain === 'exemple.fr');

  server.close();
  delete process.env.SIGNUP_CODE;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
  delete process.env.GOOGLE_AUTH_URL;
  delete process.env.GOOGLE_TOKEN_URL;
}
