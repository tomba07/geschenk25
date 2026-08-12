import { Request } from 'express';

export function appBaseUrl() {
  return process.env.APP_BASE_URL || process.env.WEB_URL || 'http://localhost:5173';
}

export function magicLinkBaseUrl(req: Request) {
  const origin = req.get('origin');
  const isLocalOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return process.env.NODE_ENV !== 'production' && isLocalOrigin ? origin : appBaseUrl();
}

export function apiBaseUrl(req: Request) {
  return (process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

export function googleRedirectUri(req: Request) {
  return `${apiBaseUrl(req)}/api/auth/google/callback`;
}

export function oauthErrorRedirect(message: string) {
  const baseUrl = appBaseUrl().replace(/\/$/, '');
  return `${baseUrl}/login?error=${encodeURIComponent(message)}`;
}
