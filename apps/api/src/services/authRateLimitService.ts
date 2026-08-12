import { Request } from 'express';

const EMAIL_COOLDOWN_MS = Number(process.env.AUTH_EMAIL_COOLDOWN_SECONDS || 60) * 1000;
const EMAIL_MAX_PER_HOUR = Number(process.env.AUTH_EMAIL_MAX_PER_HOUR || 5);
const IP_MAX_PER_HOUR = Number(process.env.AUTH_EMAIL_IP_MAX_PER_HOUR || 20);
const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000;

type RateLimitBucket = {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
};

const emailRateLimits = new Map<string, RateLimitBucket>();
const ipRateLimits = new Map<string, RateLimitBucket>();

function pruneRateLimitMap(map: Map<string, RateLimitBucket>, now: number) {
  for (const [key, bucket] of map.entries()) {
    if (now - bucket.firstAttemptAt > EMAIL_RATE_WINDOW_MS) {
      map.delete(key);
    }
  }
}

function getRateLimitBucket(map: Map<string, RateLimitBucket>, key: string, now: number) {
  const bucket = map.get(key);
  if (!bucket || now - bucket.firstAttemptAt > EMAIL_RATE_WINDOW_MS) {
    const nextBucket = { count: 0, firstAttemptAt: now, lastAttemptAt: 0 };
    map.set(key, nextBucket);
    return nextBucket;
  }
  return bucket;
}

export function checkAuthEmailRateLimit(req: Request, email: string) {
  const now = Date.now();
  pruneRateLimitMap(emailRateLimits, now);
  pruneRateLimitMap(ipRateLimits, now);

  const emailBucket = getRateLimitBucket(emailRateLimits, email, now);
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ipBucket = getRateLimitBucket(ipRateLimits, ip, now);

  const emailCooldownRemainingMs = emailBucket.lastAttemptAt > 0
    ? EMAIL_COOLDOWN_MS - (now - emailBucket.lastAttemptAt)
    : 0;

  if (emailCooldownRemainingMs > 0) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(emailCooldownRemainingMs / 1000),
      message: 'Please wait before requesting another email.',
    };
  }

  if (emailBucket.count >= EMAIL_MAX_PER_HOUR) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((EMAIL_RATE_WINDOW_MS - (now - emailBucket.firstAttemptAt)) / 1000),
      message: 'Too many emails requested for this address. Please try again later.',
    };
  }

  if (ipBucket.count >= IP_MAX_PER_HOUR) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((EMAIL_RATE_WINDOW_MS - (now - ipBucket.firstAttemptAt)) / 1000),
      message: 'Too many email requests. Please try again later.',
    };
  }

  emailBucket.count += 1;
  emailBucket.lastAttemptAt = now;
  ipBucket.count += 1;
  ipBucket.lastAttemptAt = now;

  return { allowed: true, retryAfterSeconds: 0, message: '' };
}
