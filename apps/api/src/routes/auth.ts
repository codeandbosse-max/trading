import { Router, type CookieOptions, type Response } from 'express';
import { loginSchema, registerSchema } from '@trading/shared';
import { config } from '../config';
import {
  authenticate,
  countUsers,
  createSession,
  destroySession,
  findOrCreateGoogleUser,
  registerUser,
} from '../services/auth';
import { buildAuthUrl, exchangeCode, randomState } from '../services/google';
import { recordAudit } from '../services/journal';
import { asyncHandler, HttpError } from '../middleware/errors';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth';

export const authRouter = Router();

function cookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    expires: expiresAt,
    path: '/',
  };
}

async function openSession(res: Response, userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(userId);
  res.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Tells the sign-up form whether the first account is still to be created. */
authRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    if (!config.authRequired) {
      res.json({
        bootstrap: false,
        signupCodeRequired: false,
        googleEnabled: false,
        authRequired: false,
      });
      return;
    }

    const total = await countUsers();
    res.json({
      bootstrap: total === 0,
      signupCodeRequired: total > 0 && Boolean(config.signupCode),
      googleEnabled: config.googleEnabled,
      authRequired: config.authRequired,
    });
  })
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await registerUser(input);
    await openSession(res, user.id);
    await recordAudit('compte.creation', user.email, 'warning', req.ip ?? '-', user.email);
    res.status(201).json(user);
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await authenticate(input.email, input.password);
    await openSession(res, user.id);
    await recordAudit('compte.connexion', user.email, 'info', req.ip ?? '-', user.email);
    res.json(user);
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.sessionToken) {
      await destroySession(req.sessionToken);
      if (req.user) {
        await recordAudit('compte.deconnexion', req.user.email, 'info', req.ip ?? '-', req.user.email);
      }
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);

/* ------------------------------- Google OAuth ------------------------------ */

const OAUTH_COOKIE = 'signaldesk_oauth';

authRouter.get(
  '/google',
  asyncHandler(async (req, res) => {
    if (!config.googleEnabled) {
      throw new HttpError(503, 'La connexion Google n’est pas configurée.');
    }

    const state = randomState();
    const signupCode = typeof req.query.signupCode === 'string' ? req.query.signupCode : '';

    res.cookie(OAUTH_COOKIE, JSON.stringify({ state, signupCode }), {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    res.redirect(buildAuthUrl(state));
  })
);

authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const fail = (reason: string) =>
      res.redirect(`${config.webUrl}/login?error=${encodeURIComponent(reason)}`);

    if (typeof req.query.error === 'string') {
      return fail('Connexion Google annulée.');
    }

    let stored: { state?: string; signupCode?: string } = {};
    try {
      stored = JSON.parse(req.cookies?.[OAUTH_COOKIE] ?? '{}');
    } catch {
      stored = {};
    }
    res.clearCookie(OAUTH_COOKIE, { path: '/' });

    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!stored.state || stored.state !== state) {
      return fail('Requête Google invalide, veuillez recommencer.');
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return fail('Code d’autorisation manquant.');

    try {
      const profile = await exchangeCode(code);
      const user = await findOrCreateGoogleUser(profile, stored.signupCode);
      await openSession(res, user.id);
      await recordAudit('compte.connexion_google', user.email, 'info', req.ip ?? '-', user.email);
      return res.redirect(`${config.webUrl}/dashboard`);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'Connexion Google impossible.';
      return fail(message);
    }
  })
);
