import type { NotificationItem } from '@trading/shared';
import { config } from '../config';

const RANK: Record<string, number> = { info: 0, success: 0, warning: 1, error: 2 };

function shouldDispatch(severity: string): boolean {
  return (RANK[severity] ?? 0) >= (RANK[config.alerts.minSeverity] ?? 1);
}

async function post(url: string, body: unknown, timeoutMs = 5000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Slack expects `text`, Discord expects `content`; sending both satisfies either. */
function chatPayload(notification: NotificationItem): Record<string, string> {
  const icon = notification.severity === 'error' ? '🔴' : notification.severity === 'warning' ? '🟠' : '🟢';
  const line = `${icon} *${notification.title}* — ${notification.message}`;
  return { text: line, content: line };
}

async function sendEmail(notification: NotificationItem): Promise<void> {
  const { smtpUrl, emailFrom, emailTo } = config.alerts;
  if (!smtpUrl || !emailTo) return;

  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport(smtpUrl);
  await transport.sendMail({
    from: emailFrom || emailTo,
    to: emailTo,
    subject: `[SignalDesk] ${notification.title}`,
    text: `${notification.message}\n\nSévérité : ${notification.severity}\nHorodatage : ${notification.timestamp}`,
  });
}

/**
 * Fans a notification out to the configured channels.
 * Failures are logged and swallowed: alerting must never block the trading path.
 */
export async function dispatchAlert(notification: NotificationItem): Promise<void> {
  if (!shouldDispatch(notification.severity)) return;

  const { webhookUrl, chatWebhookUrl } = config.alerts;
  const tasks: Promise<unknown>[] = [];

  if (webhookUrl) {
    tasks.push(post(webhookUrl, notification));
  }
  if (chatWebhookUrl) {
    tasks.push(post(chatWebhookUrl, chatPayload(notification)));
  }
  tasks.push(sendEmail(notification));

  const results = await Promise.allSettled(tasks);
  results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .forEach((r) => console.error('[alerte] envoi échoué:', r.reason));
}
