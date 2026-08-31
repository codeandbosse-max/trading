import { Router, type CookieOptions, type Response } from 'express';
import { loginSchema, registerSchema } from '@trading/shared';
import { config } from '../config';
import {
  authenticate,
  countUsers,
  createSession,
  destroySession,
  registerUser,
} from '../services/auth';
import { recordAudit } from '../services/journal';
import { asyncHandler } from '../middleware/errors';
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
    const total = await countUsers();
    res.json({ bootstrap: total === 0, signupCodeRequired: total > 0 && Boolean(config.signupCode) });
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
