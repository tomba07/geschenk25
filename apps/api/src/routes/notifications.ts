import express from 'express';
import pool from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ensureNotificationPreferences, getPushNotificationConfig } from '../utils/notifications';

const router = express.Router();

router.get('/email/unsubscribe/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const result = await pool.query(
      `UPDATE notification_preferences
       SET email_enabled = false, updated_at = NOW()
       WHERE unsubscribe_token = $1
       RETURNING user_id`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderUnsubscribePage('Invalid unsubscribe link', 'This unsubscribe link is invalid or has expired.'));
    }

    res.send(renderUnsubscribePage('Email notifications disabled', 'You will no longer receive Geschenk notification emails. Sign-in emails still work.'));
  } catch (error: any) {
    console.error('Error unsubscribing from notification emails:', error);
    res.status(500).send(renderUnsubscribePage('Something went wrong', 'Please try again later.'));
  }
});

router.post('/email/unsubscribe/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const result = await pool.query(
      `UPDATE notification_preferences
       SET email_enabled = false, updated_at = NOW()
       WHERE unsubscribe_token = $1
       RETURNING user_id`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid unsubscribe link' });
    }

    res.json({ message: 'Email notifications disabled' });
  } catch (error: any) {
    console.error('Error unsubscribing from notification emails:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

router.use(authenticateToken);

router.get('/config', (_req: AuthRequest, res) => {
  res.json(getPushNotificationConfig());
});

router.get('/preferences', async (req: AuthRequest, res) => {
  try {
    const preferences = await ensureNotificationPreferences(req.userId!);
    res.json({ email_enabled: preferences.email_enabled });
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

router.put('/preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const emailEnabled = Boolean(req.body?.email_enabled);
    const preferences = await ensureNotificationPreferences(userId);

    const result = await pool.query(
      `UPDATE notification_preferences
       SET email_enabled = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING email_enabled`,
      [emailEnabled, userId]
    );

    res.json({
      email_enabled: result.rows[0]?.email_enabled ?? preferences.email_enabled,
    });
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

router.post('/push-subscriptions', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const subscription = req.body?.subscription;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid push subscription' });
    }

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (endpoint)
       DO UPDATE SET user_id = EXCLUDED.user_id,
                     p256dh = EXCLUDED.p256dh,
                     auth = EXCLUDED.auth,
                     updated_at = NOW()`,
      [userId, endpoint, p256dh, auth]
    );

    res.json({ message: 'Push notifications enabled' });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to enable push notifications' });
  }
});

router.delete('/push-subscriptions', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const endpoint = req.body?.endpoint;

    if (!endpoint) {
      return res.status(400).json({ error: 'Push subscription endpoint is required' });
    }

    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );

    res.json({ message: 'Push notifications disabled' });
  } catch (error: any) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to disable push notifications' });
  }
});

export default router;

function renderUnsubscribePage(title: string, message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, system-ui, sans-serif; background: #eef5ff; color: #08245a; }
      main { width: min(100% - 32px, 520px); padding: 32px; background: white; border: 1px solid #cfe0f7; border-radius: 16px; box-shadow: 0 18px 40px rgba(8, 36, 90, 0.12); }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0; color: #40567a; font-size: 17px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
