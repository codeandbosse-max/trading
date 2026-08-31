import type { NextFunction, Request, Response } from 'express';
import type { User } from '@trading/shared';
import { findUserBySession } from '../services/auth';
import { HttpError } from './errors';

export const SESSION_COOKIE = 'signaldesk_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

function readToken(req: Request): string | null {
  const fromCookie = req.cookies?.[SESSION_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;

  const header = req.header('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();

  return null;
}

/** Populates `req.user` when a valid session is present, without rejecting. */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readToken(req);
    if (token) {
      const user = await findUserBySession(token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new HttpError(401, 'Authentification requise.'));
    return;
  }
  next();
}

/** Read-only accounts may consult everything but change nothing. */
export function requireWriteAccess(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  if (req.user?.role === 'lecture') {
    next(new HttpError(403, 'Votre compte est en lecture seule.'));
    return;
  }
  next();
}
