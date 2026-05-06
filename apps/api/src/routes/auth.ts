import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function validateUsername(username: string) {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
  return null;
}

function createSessionToken(user: any) {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return jwt.sign(
    { userId: user.id, username: user.username },
    secret,
    { expiresIn: '7d' }
  );
}

function createMagicToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashMagicToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function shortHash(value: string) {
  return value.slice(0, 10);
}

function shouldLogMagicLinkDetails() {
  return process.env.DEBUG_MAGIC_LINKS === 'true';
}

function appBaseUrl() {
  return process.env.APP_BASE_URL || process.env.WEB_URL || 'http://localhost:5173';
}

function magicLinkBaseUrl(req: Request) {
  const origin = req.get('origin');
  const isLocalOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return process.env.NODE_ENV !== 'production' && isLocalOrigin ? origin : appBaseUrl();
}

async function sendMagicLink(email: string, link: string) {
  const emailDeliveryDisabled = process.env.DISABLE_EMAIL_DELIVERY === 'true';
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (emailDeliveryDisabled || !resendApiKey || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email provider is not configured');
    }

    console.log(`Magic link for ${email}: ${link}`);
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
      to: email,
      subject: 'Sign in to Geschenk',
      html: `<p>Use this link to sign in to Geschenk:</p><p><a href="${link}">Sign in to Geschenk</a></p><p>This link expires in 15 minutes.</p>`,
      text: `Use this link to sign in to Geschenk: ${link}\n\nThis link expires in 15 minutes.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send magic link email: ${body}`);
  }

  return { delivered: true };
}

// Request magic link for login or signup.
router.post('/request-link', async (req: Request, res: Response) => {
  try {
    const { email, username } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const userResult = await pool.query('SELECT id, email, username FROM users WHERE email = $1', [normalizedEmail]);
    const existingUser = userResult.rows[0];
    let normalizedUsername: string | null = null;

    if (!existingUser) {
      if (!username) {
        return res.status(400).json({ error: 'Username is required to create an account' });
      }

      normalizedUsername = normalizeUsername(username);
      const usernameError = validateUsername(normalizedUsername);
      if (usernameError) {
        return res.status(400).json({ error: usernameError });
      }

      const usernameResult = await pool.query('SELECT id FROM users WHERE username = $1', [normalizedUsername]);
      if (usernameResult.rows.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const token = createMagicToken();
    const tokenHash = hashMagicToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      'UPDATE magic_links SET used_at = NOW() WHERE email = $1 AND used_at IS NULL',
      [normalizedEmail]
    );

    await pool.query(
      'INSERT INTO magic_links (email, username, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [normalizedEmail, normalizedUsername, tokenHash, expiresAt]
    );

    const baseUrl = magicLinkBaseUrl(req);
    const link = `${baseUrl.replace(/\/$/, '')}/auth/callback?token=${encodeURIComponent(token)}`;
    if (shouldLogMagicLinkDetails()) {
      console.log('Magic link created:', {
        email: normalizedEmail,
        token: shortHash(tokenHash),
        expiresAt: expiresAt.toISOString(),
        appBaseUrl: baseUrl,
      });
    }
    const delivery = await sendMagicLink(normalizedEmail, link);

    res.json({
      message: 'Check your email for a sign-in link.',
      expires_in_minutes: 15,
      ...(delivery.delivered ? {} : { devMagicLink: link }),
    });
  } catch (error: any) {
    console.error('Magic link request error:', error);
    res.status(500).json({ error: 'Failed to send sign-in link' });
  }
});

// Verify magic link and create a session.
router.post('/verify-link', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    const tokenHash = hashMagicToken(token);
    if (shouldLogMagicLinkDetails()) {
      console.log('Magic link verify requested:', { token: shortHash(tokenHash) });
    }
    await client.query('BEGIN');

    const linkResult = await client.query(
      `SELECT id, email, username, expires_at, used_at
       FROM magic_links
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (linkResult.rows.length === 0) {
      const debugResult = await client.query(
        `SELECT expires_at, used_at, NOW() as now
         FROM magic_links
         WHERE token_hash = $1`,
        [tokenHash]
      );
      if (shouldLogMagicLinkDetails()) {
        console.log('Magic link verify failed:', {
          token: shortHash(tokenHash),
          found: debugResult.rows.length > 0,
          ...(debugResult.rows[0] || {}),
        });
      }
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This sign-in link is invalid or expired' });
    }

    const magicLink = linkResult.rows[0];
    const now = Date.now();
    const expiresAt = new Date(magicLink.expires_at).getTime();
    const usedAt = magicLink.used_at ? new Date(magicLink.used_at).getTime() : null;
    const usedGraceMs = 2 * 60 * 1000;

    if (expiresAt <= now || (usedAt !== null && usedAt <= now - usedGraceMs)) {
      if (shouldLogMagicLinkDetails()) {
        console.log('Magic link verify rejected:', {
          token: shortHash(tokenHash),
          expiresAt: new Date(expiresAt).toISOString(),
          usedAt: usedAt ? new Date(usedAt).toISOString() : null,
          now: new Date(now).toISOString(),
        });
      }
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This sign-in link is invalid or expired' });
    }

    if (!magicLink.used_at) {
      await client.query('UPDATE magic_links SET used_at = NOW() WHERE id = $1', [magicLink.id]);
    }

    let userResult = await client.query(
      'SELECT id, email, username, image_url FROM users WHERE email = $1',
      [magicLink.email]
    );

    let user = userResult.rows[0];
    if (!user) {
      if (!magicLink.username) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This sign-in link cannot create an account' });
      }

      userResult = await client.query(
        `INSERT INTO users (email, username, password_hash, email_verified_at)
         VALUES ($1, $2, NULL, NOW())
         RETURNING id, email, username, image_url`,
        [magicLink.email, magicLink.username]
      );
      user = userResult.rows[0];
    } else {
      userResult = await client.query(
        'UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1 RETURNING id, email, username, image_url',
        [user.id]
      );
      user = userResult.rows[0];
    }

    await client.query('COMMIT');

    res.json({
      token: createSessionToken(user),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Magic link verification error:', error);
    res.status(500).json({ error: 'Failed to verify sign-in link' });
  } finally {
    client.release();
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT id, email, username, password_hash, image_url FROM users WHERE email = $1', [
      normalizeEmail(email),
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Use a magic link to sign in, or set a password first.' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      token: createSessionToken(user),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Search users by username (requires authentication)
router.get('/search', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    jwt.verify(token, secret);

    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 1) {
      return res.json({ users: [] });
    }

    const searchTerm = `%${q.toLowerCase().trim()}%`;
    const result = await pool.query(
      'SELECT id, username, image_url FROM users WHERE username LIKE $1 ORDER BY username LIMIT 20',
      [searchTerm]
    );

    const users = result.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      image_url: row.image_url,
    }));

    res.json({ users });
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Verify token (for checking if user is authenticated)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded: any = jwt.verify(token, secret);

    // Get fresh user data
    const result = await pool.query('SELECT id, email, username, image_url, created_at FROM users WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
      },
    });
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Update user profile image
router.put('/profile/image', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { image_url } = req.body;

    if (image_url !== undefined && image_url !== null && typeof image_url !== 'string') {
      return res.status(400).json({ error: 'image_url must be a string or null' });
    }

    const result = await pool.query(
      'UPDATE users SET image_url = $1 WHERE id = $2 RETURNING id, email, username, image_url',
      [image_url || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
      },
    });
  } catch (error: any) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ error: 'Failed to update profile image' });
  }
});

// Set or replace optional password.
router.put('/profile/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Delete account
router.delete('/account', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the user - this will cascade delete all related data due to ON DELETE CASCADE.
    // Related data includes groups, memberships, invitations, assignments, and gift ideas.
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
