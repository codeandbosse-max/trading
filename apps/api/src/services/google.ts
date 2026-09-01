import { randomBytes } from 'crypto';
import { config } from '../config';
import { HttpError } from '../middleware/errors';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  hostedDomain?: string;
}

export function randomState(): string {
  return randomBytes(24).toString('hex');
}

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri, authUrl, allowedDomain } = config.google;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  if (allowedDomain) params.set('hd', allowedDomain);
  return `${authUrl}?${params.toString()}`;
}

/** Decodes the JWT payload without verifying the signature. */
function decodeSegment(token: string): Record<string, any> {
  const segment = token.split('.')[1];
  if (!segment) throw new HttpError(502, 'Jeton Google illisible.');
  const json = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json);
}

/**
 * The id_token is read straight from Google's token endpoint over TLS, so its
 * signature is not re-verified; the issuer, audience and expiry still are.
 */
export function readIdToken(idToken: string): GoogleProfile {
  const claims = decodeSegment(idToken);

  const issuers = ['https://accounts.google.com', 'accounts.google.com'];
  if (!issuers.includes(String(claims.iss))) {
    throw new HttpError(502, 'Émetteur du jeton Google inattendu.');
  }
  if (claims.aud !== config.google.clientId) {
    throw new HttpError(502, 'Jeton Google destiné à une autre application.');
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
    throw new HttpError(502, 'Jeton Google expiré.');
  }
  if (!claims.sub || !claims.email) {
    throw new HttpError(502, 'Profil Google incomplet.');
  }

  return {
    googleId: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    name: String(claims.name ?? claims.email),
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    hostedDomain: claims.hd ? String(claims.hd) : undefined,
  };
}

export async function exchangeCode(code: string): Promise<GoogleProfile> {
  const { clientId, clientSecret, redirectUri, tokenUrl } = config.google;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      signal: controller.signal,
    });
  } catch {
    throw new HttpError(502, 'Google est injoignable.');
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.id_token) {
    throw new HttpError(401, 'Échec de l’authentification Google.');
  }

  const profile = readIdToken(body.id_token);

  if (!profile.emailVerified) {
    throw new HttpError(403, 'Adresse Google non vérifiée.');
  }
  if (config.google.allowedDomain && profile.hostedDomain !== config.google.allowedDomain) {
    throw new HttpError(403, 'Domaine Google non autorisé.');
  }

  return profile;
}
