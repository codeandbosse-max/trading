import type { AuditLog, NotificationItem, Severity } from '@trading/shared';
import { getDb } from '../db/pool';
import { uid } from '../lib/crypto';
import { config } from '../config';
import { mapAuditLog, mapNotification } from '../repositories/queries';

export async function recordAudit(
  action: string,
  target: string,
  severity: Severity = 'info',
  ip = '-',
  actor = config.actor
): Promise<AuditLog> {
  const { rows } = await getDb().query(
    `INSERT INTO audit_logs (id, timestamp, actor, action, target, ip, severity)
     VALUES ($1, now(), $2, $3, $4, $5, $6) RETURNING *`,
    [uid('audit'), actor, action, target, ip, severity]
  );
  return mapAuditLog(rows[0]);
}

export async function pushNotification(
  input: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>
): Promise<NotificationItem> {
  const { rows } = await getDb().query(
    `INSERT INTO notifications (id, type, title, message, severity, timestamp, read)
     VALUES ($1, $2, $3, $4, $5, now(), false) RETURNING *`,
    [uid('notif'), input.type, input.title, input.message, input.severity]
  );
  return mapNotification(rows[0]);
}
