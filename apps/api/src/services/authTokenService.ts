import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export function createSessionToken(user: { id: number; username?: string | null }) {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return jwt.sign(
    { userId: user.id, username: user.username || null },
    secret,
    { expiresIn: '7d' }
  );
}

export function createOAuthState(mode: string) {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return jwt.sign({ provider: 'google', mode }, secret, { expiresIn: '10m' });
}

export function verifyOAuthState(state: string) {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const decoded = jwt.verify(state, secret) as any;
  if (decoded.provider !== 'google') {
    throw new Error('Invalid OAuth state');
  }
  return decoded;
}

export function createMagicToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashMagicToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function shortHash(value: string) {
  return value.slice(0, 10);
}

export function shouldLogMagicLinkDetails() {
  return process.env.DEBUG_MAGIC_LINKS === 'true';
}
