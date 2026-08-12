import pool from '../db';
import { escapeHtml, renderEmailTemplate } from '../utils/emailTemplates';
import { createMagicToken, hashMagicToken } from './authTokenService';

export const PASSWORD_RESET_EXPIRES_MINUTES = 30;

export async function createLocalMagicLinkToken(email: string) {
  const token = createMagicToken();
  const tokenHash = hashMagicToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    'UPDATE magic_links SET used_at = NOW() WHERE email = $1 AND used_at IS NULL',
    [email]
  );

  await pool.query(
    'INSERT INTO magic_links (email, username, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [email, null, tokenHash, expiresAt]
  );

  return token;
}

async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const emailDeliveryDisabled = process.env.DISABLE_EMAIL_DELIVERY === 'true';
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (emailDeliveryDisabled || !resendApiKey || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email provider is not configured');
    }

    return { delivered: false };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send email: ${body}`);
  }

  return { delivered: true };
}

export async function sendMagicLink(email: string, link: string) {
  const delivery = await sendTransactionalEmail({
    to: email,
    subject: 'Sign in to Geschenk',
    html: renderEmailTemplate({
      preheader: 'Use this link to sign in to Geschenk. It expires in 15 minutes.',
      eyebrow: 'Secure sign in',
      title: 'Sign in to Geschenk',
      bodyHtml: '<p style="margin: 0;">Use this secure link to sign in. It expires in 15 minutes.</p>',
      action: {
        label: 'Sign in to Geschenk',
        url: link,
      },
      footerHtml: `If you did not request this email, you can ignore it. For security, this link works once and expires soon.<br><br><span style="word-break: break-all;">${escapeHtml(link)}</span>`,
    }),
    text: `Use this link to sign in to Geschenk: ${link}\n\nThis link expires in 15 minutes.`,
  });

  if (!delivery.delivered) {
    console.log(`Magic link for ${email}: ${link}`);
  }

  return delivery;
}

export async function createPasswordResetToken(userId: number) {
  const token = createMagicToken();
  const tokenHash = hashMagicToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

  await pool.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  );

  await pool.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  return { token, tokenHash, expiresAt };
}

export async function sendPasswordResetEmail(email: string, link: string) {
  const delivery = await sendTransactionalEmail({
    to: email,
    subject: 'Reset your Geschenk password',
    html: renderEmailTemplate({
      preheader: `Use this link to reset your Geschenk password. It expires in ${PASSWORD_RESET_EXPIRES_MINUTES} minutes.`,
      eyebrow: 'Password reset',
      title: 'Reset your Geschenk password',
      bodyHtml: '<p style="margin: 0;">Use this secure link to choose a new password.</p>',
      action: {
        label: 'Reset password',
        url: link,
      },
      footerHtml: `If you did not request this email, you can ignore it. This link works once and expires soon.<br><br><span style="word-break: break-all;">${escapeHtml(link)}</span>`,
    }),
    text: `Use this link to reset your Geschenk password: ${link}\n\nThis link expires in ${PASSWORD_RESET_EXPIRES_MINUTES} minutes.`,
  });

  if (!delivery.delivered) {
    console.log(`Password reset link for ${email}: ${link}`);
  }

  return delivery;
}
