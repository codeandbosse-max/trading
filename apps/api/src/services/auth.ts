import { createHash, randomBytes } from 'crypto';
import type { User, UserRole } from '@trading/shared';
import { getDb } from '../db/pool';
import { uid } from '../lib/crypto';
import { hashPassword, verifyPassword } from '../lib/password';
import { config } from '../config';
import { HttpError } from '../middleware/errors';

const SESSION_DAYS = 7;

type Row = Record<string, any>;

export function mapUser(row: Row): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/** Only the hash is stored: a database leak does not hand over live sessions. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function countUsers(): Promise<number> {
  const { rows } = await getDb().query(`SELECT COUNT(*) AS total FROM users`);
  return Number.parseInt(String(rows[0]?.total ?? '0'), 10) || 0;
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
  signupCode?: string;
}): Promise<User> {
  const existingUsers = await countUsers();

  // The first account bootstraps the platform; later ones need an invitation code.
  if (existingUsers > 0) {
    if (!config.signupCode) {
      throw new HttpError(403, 'Les inscriptions sont fermées. Contactez un administrateur.');
    }
    if (input.signupCode !== config.signupCode) {
      throw new HttpError(403, 'Code d’inscription invalide.');
    }
  }

  const role: UserRole = existingUsers === 0 ? 'admin' : 'operateur';
  const passwordHash = await hashPassword(input.password);

  try {
    const { rows } = await getDb().query(
      `INSERT INTO users (id, email, name, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
      [uid('user'), input.email, input.name, passwordHash, role]
    );
    return mapUser(rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('unique') || message.includes('duplicate')) {
      throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée.');
    }
    throw err;
  }
}

export async function authenticate(email: string, password: string): Promise<User> {
  const { rows } = await getDb().query(`SELECT * FROM users WHERE email = $1`, [email]);
  const row = rows[0];

  // Always run a hash comparison so timing does not reveal whether the account exists.
  const stored = row?.password_hash ?? 'scrypt$16384$00$00';
  const valid = await verifyPassword(password, stored);

  if (!row || !valid) {
    throw new HttpError(401, 'Adresse e-mail ou mot de passe incorrect.');
  }
  return mapUser(row);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await getDb().query(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES ($1, $2, $3, now(), $4)`,
    [uid('sess'), userId, hashToken(token), expiresAt.toISOString()]
  );

  return { token, expiresAt };
}

export async function findUserBySession(token: string): Promise<User | null> {
  const { rows } = await getDb().query(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function destroySession(token: string): Promise<void> {
  await getDb().query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

export async function listUsers(): Promise<User[]> {
  const { rows } = await getDb().query(`SELECT * FROM users ORDER BY created_at`);
  return rows.map(mapUser);
}

/**
 * Signs in a Google account, linking it to an existing address when needed.
 * Account creation follows the same bootstrap and invitation rules as the form.
 */
export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
}, signupCode?: string): Promise<User> {
  const db = getDb();

  const byGoogle = await db.query(`SELECT * FROM users WHERE google_id = $1`, [profile.googleId]);
  if (byGoogle.rows[0]) return mapUser(byGoogle.rows[0]);

  const byEmail = await db.query(`SELECT * FROM users WHERE email = $1`, [profile.email]);
  if (byEmail.rows[0]) {
    const { rows } = await db.query(
      `UPDATE users SET google_id = $2 WHERE id = $1 RETURNING *`,
      [byEmail.rows[0].id, profile.googleId]
    );
    return mapUser(rows[0]);
  }

  const existingUsers = await countUsers();
  if (existingUsers > 0) {
    if (!config.signupCode) {
      throw new HttpError(403, 'Les inscriptions sont fermées. Contactez un administrateur.');
    }
    if (signupCode !== config.signupCode) {
      throw new HttpError(403, 'Code d’inscription requis pour créer un compte.');
    }
  }

  const role: UserRole = existingUsers === 0 ? 'admin' : 'operateur';
  const { rows } = await db.query(
    `INSERT INTO users (id, email, name, password_hash, google_id, role, created_at)
     VALUES ($1, $2, $3, NULL, $4, $5, now()) RETURNING *`,
    [uid('user'), profile.email, profile.name, profile.googleId, role]
  );
  return mapUser(rows[0]);
}
