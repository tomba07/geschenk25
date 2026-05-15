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

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const emailDeliveryDisabled = process.env.DISABLE_EMAIL_DELIVERY === 'true';
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || (emailFrom ? `mailto:${emailFrom}` : undefined);

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
    sendPushNotification(userId, payload),
  ]);
}

async function sendEmailNotification(userId: number, payload: NotificationPayload) {
  if (emailDeliveryDisabled || !resendApiKey || !emailFrom) {
    return;
  }

  const preferences = await ensureNotificationPreferences(userId);
  if (!preferences.email_enabled) return;

  const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
  const email = userResult.rows[0]?.email;
  if (!email) return;

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

async function sendPushNotification(userId: number, payload: NotificationPayload) {
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
