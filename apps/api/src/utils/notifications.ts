import webpush, { PushSubscription } from 'web-push';
import crypto from 'crypto';
import pool from '../db';
import { escapeHtml, renderEmailTemplate } from './emailTemplates';

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  emailSubject?: string;
  emailText?: string;
  emailHtml?: string;
  emailActionLabel?: string;
}

interface QueuedEmailNotificationInput {
  userId: number;
  groupId: number;
  assignmentId: number;
  type: 'assignment_chat_message';
  payload: NotificationPayload;
  delayMinutes?: number;
}

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const emailDeliveryDisabled = process.env.DISABLE_EMAIL_DELIVERY === 'true';
const emailBatchingDisabled = process.env.DISABLE_EMAIL_BATCHING === 'true';
const defaultEmailBatchDelayMinutes = Number(process.env.EMAIL_BATCH_DELAY_MINUTES || '10');
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || (emailFrom ? `mailto:${emailFrom}` : undefined);
const blockedNotificationEmailDomains = new Set([
  'geschenk.test',
  'example.com',
  'example.net',
  'example.org',
  'invalid',
  'localhost',
  'test',
]);

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function getPushNotificationConfig() {
  return {
    enabled: Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject),
    publicKey: vapidPublicKey || null,
  };
}

export async function sendNotificationToUser(userId: number, payload: NotificationPayload) {
  await Promise.allSettled([
    sendEmailNotification(userId, payload),
    sendPushNotificationToUser(userId, payload),
  ]);
}

export async function queueEmailNotification(input: QueuedEmailNotificationInput) {
  if (emailBatchingDisabled) {
    await sendEmailNotification(input.userId, input.payload);
    return;
  }

  const delayMinutes = Number.isFinite(input.delayMinutes)
    ? input.delayMinutes!
    : defaultEmailBatchDelayMinutes;

  await pool.query(
    `INSERT INTO pending_email_notifications (
       user_id,
       group_id,
       assignment_id,
       type,
       count,
       title,
       body,
       url,
       email_subject,
       email_text,
       email_action_label,
       send_after
     )
     VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP + ($11 || ' minutes')::interval)
     ON CONFLICT (
       user_id,
       type,
       group_id,
       assignment_id
     )
     WHERE sent_at IS NULL
     DO UPDATE SET
       count = pending_email_notifications.count + 1,
       title = EXCLUDED.title,
       body = EXCLUDED.body,
       url = EXCLUDED.url,
       email_subject = EXCLUDED.email_subject,
       email_text = EXCLUDED.email_text,
       email_action_label = EXCLUDED.email_action_label,
       last_event_at = CURRENT_TIMESTAMP,
       send_after = EXCLUDED.send_after,
       updated_at = CURRENT_TIMESTAMP`,
    [
      input.userId,
      input.groupId,
      input.assignmentId,
      input.type,
      input.payload.title,
      input.payload.body,
      input.payload.url || null,
      input.payload.emailSubject || input.payload.title,
      input.payload.emailText || input.payload.body,
      input.payload.emailActionLabel || null,
      Math.max(0, delayMinutes),
    ]
  );
}

export async function cancelPendingAssignmentChatEmail(userId: number, assignmentId: number) {
  await pool.query(
    `DELETE FROM pending_email_notifications
     WHERE user_id = $1
       AND assignment_id = $2
       AND type = 'assignment_chat_message'
       AND sent_at IS NULL`,
    [userId, assignmentId]
  );
}

export async function processPendingEmailNotifications(limit = 25) {
  if (emailBatchingDisabled) return;

  const dueResult = await pool.query(
    `SELECT id, user_id, count, title, body, url, email_subject, email_text, email_action_label
     FROM pending_email_notifications
     WHERE sent_at IS NULL AND send_after <= CURRENT_TIMESTAMP
     ORDER BY send_after ASC
     LIMIT $1`,
    [limit]
  );

  for (const row of dueResult.rows) {
    const count = Number(row.count) || 1;
    const payload: NotificationPayload = {
      title: row.title,
      body: count > 1 ? `${row.body} (${count} new messages)` : row.body,
      url: row.url,
      emailSubject: row.email_subject,
      emailText: row.email_text,
      emailActionLabel: row.email_action_label,
    };

    if (count > 1) {
      payload.emailSubject = `${row.email_subject} (${count})`;
      payload.emailText = `${row.email_text}\n\n${count} new messages were sent before this email.`;
    }

    try {
      await sendEmailNotification(row.user_id, payload);
      await pool.query(
        `UPDATE pending_email_notifications
         SET sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND sent_at IS NULL`,
        [row.id]
      );
    } catch (error) {
      console.error(`Failed to process pending email notification ${row.id}:`, error);
    }
  }
}

export function startPendingEmailNotificationProcessor() {
  if (emailBatchingDisabled) return undefined;

  const intervalMs = Number(process.env.EMAIL_BATCH_PROCESS_INTERVAL_MS || '60000');
  const run = () => {
    processPendingEmailNotifications().catch((error) => {
      console.error('Failed to process pending email notifications:', error);
    });
  };

  const interval = setInterval(run, Math.max(5000, intervalMs));
  interval.unref?.();
  run();

  return () => clearInterval(interval);
}

async function sendEmailNotification(userId: number, payload: NotificationPayload) {
  if (emailDeliveryDisabled || !resendApiKey || !emailFrom) {
    return;
  }

  const preferences = await ensureNotificationPreferences(userId);
  if (!preferences.email_enabled) return;

  const userResult = await pool.query('SELECT email, is_test_account FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];
  if (!user || user.is_test_account) return;

  const email = user.email;
  if (!email) return;
  if (!isDeliverableNotificationEmail(email)) return;

  const unsubscribeUrl = getUnsubscribeUrl(preferences.unsubscribe_token);
  const emailHtml = renderNotificationEmail(payload, unsubscribeUrl);
  const eventUrl = getEventUrl(payload.url);
  const textParts = [payload.emailText || payload.body];
  if (eventUrl) {
    textParts.push(`Open this update: ${eventUrl}`);
  }
  textParts.push(`Unsubscribe from Geschenk notification emails: ${unsubscribeUrl}`);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: email,
      subject: payload.emailSubject || payload.title,
      text: textParts.join('\n\n'),
      html: emailHtml,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to send notification email to user ${userId}: ${body}`);
  }
}

function isDeliverableNotificationEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && !blockedNotificationEmailDomains.has(domain));
}

export async function sendPushNotificationToUser(userId: number, payload: NotificationPayload) {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return;
  }

  const subscriptionsResult = await pool.query(
    `SELECT id, endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE user_id = $1`,
    [userId]
  );

  await Promise.all(subscriptionsResult.rows.map(async (subscriptionRow) => {
    const subscription: PushSubscription = {
      endpoint: subscriptionRow.endpoint,
      keys: {
        p256dh: subscriptionRow.p256dh,
        auth: subscriptionRow.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
      }));
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [subscriptionRow.id]);
        return;
      }

      console.error(`Failed to send push notification to user ${userId}:`, error);
    }
  }));
}

export async function ensureNotificationPreferences(userId: number) {
  const existing = await pool.query(
    'SELECT email_enabled, unsubscribe_token FROM notification_preferences WHERE user_id = $1',
    [userId]
  );

  if (existing.rows[0]) {
    return existing.rows[0] as { email_enabled: boolean; unsubscribe_token: string };
  }

  const inserted = await pool.query(
    `INSERT INTO notification_preferences (user_id, email_enabled, unsubscribe_token)
     VALUES ($1, true, $2)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING email_enabled, unsubscribe_token`,
    [userId, crypto.randomBytes(24).toString('hex')]
  );

  return inserted.rows[0] as { email_enabled: boolean; unsubscribe_token: string };
}

function getUnsubscribeUrl(token: string) {
  const apiBaseUrl = process.env.API_BASE_URL || '';
  return `${apiBaseUrl}/api/notifications/email/unsubscribe/${token}`;
}

function renderNotificationEmail(payload: NotificationPayload, unsubscribeUrl: string) {
  const bodyHtml = payload.emailHtml || `<p style="margin: 0;">${escapeHtml(payload.body)}</p>`;
  const eventUrl = getEventUrl(payload.url);

  return renderEmailTemplate({
    preheader: payload.emailText || payload.body,
    eyebrow: 'Geschenk notification',
    title: payload.emailSubject || payload.title,
    bodyHtml,
    action: eventUrl ? { label: payload.emailActionLabel || 'Open update', url: eventUrl } : undefined,
    footerHtml: `You are receiving this because you use Geschenk. <a href="${unsubscribeUrl}" style="color: #1559b7; text-decoration: underline;">Unsubscribe from notification emails</a>.`,
  });
}

function getEventUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) return undefined;
  return `${appBaseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}
