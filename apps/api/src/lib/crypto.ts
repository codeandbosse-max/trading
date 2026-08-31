import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { config } from '../config';

export function uid(prefix: string): string {
  return `${prefix}-${randomBytes(6).toString('hex')}`;
}

export function newWebhookId(): string {
  return `wd_${randomBytes(6).toString('hex')}`;
}

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export function verifySignature(rawBody: string, secret: string, signature: string): boolean {
  const provided = signature.trim().replace(/^sha256=/i, '');
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function key(): Buffer {
  return Buffer.from(config.encryptionKey, 'hex');
}

/** AES-256-GCM envelope: iv:tag:ciphertext, all hex encoded. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Format chiffré invalide.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
