import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import {
  PASSWORD_RESET_EXPIRES_MINUTES,
  createLocalMagicLinkToken,
  createPasswordResetToken,
  sendMagicLink,
  sendPasswordResetEmail,
} from '../services/authEmailService';
import { checkAuthEmailRateLimit } from '../services/authRateLimitService';
import {
  createMagicToken,
  createOAuthState,
  createSessionToken,
  hashMagicToken,
  shortHash,
  shouldLogMagicLinkDetails,
  verifyOAuthState,
} from '../services/authTokenService';
import { appBaseUrl, googleRedirectUri, magicLinkBaseUrl, oauthErrorRedirect } from '../services/authUrlService';
import type {
  AuthEmailLinkResponse,
  AuthSessionResponse,
  MessageResponse,
  PasswordResetRequestResponse,
  SearchUsersResponse,
  UserResponse,
} from '../contracts/api';

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

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


router.get('/google/start', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }

  const mode = req.query.mode === 'signup' ? 'signup' : 'login';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state: createOAuthState(mode),
    prompt: 'select_account',
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    if (!clientId || !clientSecret) {
      return res.redirect(oauthErrorRedirect('Google sign-in is not configured'));
    }

    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(oauthErrorRedirect('Google sign-in was canceled'));
    }
    if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
      return res.redirect(oauthErrorRedirect('Google sign-in failed'));
    }

    verifyOAuthState(state);

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${body}`);
    }

    const tokenData = await tokenResponse.json() as { id_token?: string };
    if (!tokenData.id_token) {
      throw new Error('Google did not return an ID token');
    }

    const infoResponse = await fetch(`${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(tokenData.id_token)}`);
    if (!infoResponse.ok) {
      const body = await infoResponse.text();
      throw new Error(`Google token validation failed: ${body}`);
    }

    const profile = await infoResponse.json() as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      picture?: string;
    };

    if (profile.aud !== clientId) {
      throw new Error('Google token audience mismatch');
    }
    if (!profile.email || profile.email_verified === false || profile.email_verified === 'false') {
      return res.redirect(oauthErrorRedirect('Google email is not verified'));
    }

    const email = normalizeEmail(profile.email);
    const userResult = await pool.query(
      `INSERT INTO users (email, username, password_hash, image_url, email_verified_at)
       VALUES ($1, NULL, NULL, $2, NOW())
       ON CONFLICT (email) DO UPDATE
       SET email_verified_at = COALESCE(users.email_verified_at, NOW()),
           image_url = COALESCE(users.image_url, EXCLUDED.image_url)
       RETURNING id, email, username, image_url`,
      [email, profile.picture || null]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Failed to create or update Google user');
    }

    const localToken = await createLocalMagicLinkToken(email);
    res.redirect(`${appBaseUrl().replace(/\/$/, '')}/auth/callback?token=${encodeURIComponent(localToken)}`);
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    res.redirect(oauthErrorRedirect('Google sign-in failed'));
  }
});

// Request magic link for login or signup.
router.post('/request-link', async (req: Request, res: Response) => {
  try {
    const { email, username, mode } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const rateLimit = checkAuthEmailRateLimit(req, normalizedEmail);
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        error: rateLimit.message,
        retry_after_seconds: rateLimit.retryAfterSeconds,
      });
    }

    const userResult = await pool.query('SELECT id, email, username FROM users WHERE email = $1', [normalizedEmail]);
    const existingUser = userResult.rows[0];
    if (mode === 'signup' && existingUser) {
      return res.status(409).json({
        code: 'email_exists',
        error: 'An account with this email already exists.',
      });
    }

    let normalizedUsername: string | null = null;

    if (!existingUser && username) {
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

    const response = {
      message: 'Check your email for a sign-in link.',
      expires_in_minutes: 15,
      ...(delivery.delivered ? {} : { devMagicLink: link }),
    } satisfies AuthEmailLinkResponse;
    res.json(response);
  } catch (error: any) {
    console.error('Magic link request error:', error);
    res.status(500).json({ error: 'Failed to send sign-in link' });
  }
});

// Request a password reset email. Always return success for valid email-shaped
// input so account existence is not exposed.
router.post('/password-reset/request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const rateLimit = checkAuthEmailRateLimit(req, normalizedEmail);
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        error: rateLimit.message,
        retry_after_seconds: rateLimit.retryAfterSeconds,
      });
    }

    const userResult = await pool.query(
      'SELECT id, email, is_test_account FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    if (user && !user.is_test_account) {
      const { token, tokenHash, expiresAt } = await createPasswordResetToken(user.id);
      const baseUrl = magicLinkBaseUrl(req);
      const link = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      if (shouldLogMagicLinkDetails()) {
        console.log('Password reset link created:', {
          email: normalizedEmail,
          token: shortHash(tokenHash),
          expiresAt: expiresAt.toISOString(),
          appBaseUrl: baseUrl,
        });
      }
      const delivery = await sendPasswordResetEmail(user.email, link);
      const response = {
        message: 'If an account exists for that email, a password reset link has been sent.',
        expires_in_minutes: PASSWORD_RESET_EXPIRES_MINUTES,
        ...(delivery.delivered ? {} : { devPasswordResetLink: link }),
      } satisfies PasswordResetRequestResponse;
      return res.json(response);
    }

    const response = {
      message: 'If an account exists for that email, a password reset link has been sent.',
      expires_in_minutes: PASSWORD_RESET_EXPIRES_MINUTES,
    } satisfies PasswordResetRequestResponse;
    res.json(response);
  } catch (error: any) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to send password reset link' });
  }
});

router.post('/password-reset/confirm', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const tokenHash = hashMagicToken(token);
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1 AND u.is_test_account = false
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired password reset link' });
    }

    const resetToken = tokenResult.rows[0];
    if (resetToken.used_at || new Date(resetToken.expires_at).getTime() < Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired password reset link' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetToken.user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetToken.id]);
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [resetToken.user_id]
    );
    await client.query('COMMIT');

    const response = { message: 'Password reset successfully' } satisfies MessageResponse;
    res.json(response);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Password reset confirm error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    client.release();
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

    const response = {
      token: createSessionToken(user),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
        profile_complete: Boolean(user.username),
      },
    } satisfies AuthSessionResponse;
    res.json(response);
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

    const response = {
      token: createSessionToken(user),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
        profile_complete: Boolean(user.username),
      },
    } satisfies AuthSessionResponse;
    res.json(response);
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
      const response = { users: [] } satisfies SearchUsersResponse;
      return res.json(response);
    }

    const searchTerm = `%${q.toLowerCase().trim()}%`;
    const result = await pool.query(
      'SELECT id, username, image_url FROM users WHERE username IS NOT NULL AND is_test_account = false AND username LIKE $1 ORDER BY username LIMIT 20',
      [searchTerm]
    );

    const users = result.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      image_url: row.image_url,
    }));

    const response = { users } satisfies SearchUsersResponse;
    res.json(response);
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
    const response = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
        profile_complete: Boolean(user.username),
      },
    } satisfies UserResponse;
    res.json(response);
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

    const response = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
        profile_complete: Boolean(user.username),
      },
    } satisfies UserResponse;
    res.json(response);
  } catch (error: any) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ error: 'Failed to update profile image' });
  }
});

// Complete profile after email verification.
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { username, password, image_url } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const normalizedUsername = normalizeUsername(username);
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    if (password !== undefined && password !== null && typeof password !== 'string') {
      return res.status(400).json({ error: 'Password must be a string' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (image_url !== undefined && image_url !== null && typeof image_url !== 'string') {
      return res.status(400).json({ error: 'image_url must be a string or null' });
    }

    const usernameResult = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [normalizedUsername, userId]
    );

    if (usernameResult.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const result = await pool.query(
      `UPDATE users
       SET username = $1,
           password_hash = COALESCE($2, password_hash),
           image_url = $3
       WHERE id = $4
       RETURNING id, email, username, image_url`,
      [normalizedUsername, passwordHash, image_url || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const response = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        image_url: user.image_url,
        profile_complete: true,
      },
    } satisfies UserResponse;
    res.json(response);
  } catch (error: any) {
    console.error('Error completing profile:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

// Password changes must go through the email reset flow.
router.put('/profile/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  res.status(410).json({ error: 'Password changes require an email reset link.' });
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

    const response = { message: 'Account deleted successfully' } satisfies MessageResponse;
    res.json(response);
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
