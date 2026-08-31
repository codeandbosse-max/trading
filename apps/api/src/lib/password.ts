import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto';

const KEY_LENGTH = 64;
const COST = 16384;

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** Stored as `scrypt$<cost>$<salt>$<hash>`; the salt is unique per password. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, KEY_LENGTH, { N: COST });
  return `scrypt$${COST}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, costRaw, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !costRaw || !saltHex || !hashHex) return false;

  const cost = Number.parseInt(costRaw, 10);
  const expected = Buffer.from(hashHex, 'hex');
  const derived = await derive(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N: cost,
  });

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
