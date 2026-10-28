const COOLDOWNS_MS = [10_000, 15 * 60_000, 24 * 60 * 60_000, 7 * 24 * 60 * 60_000];

export function rejectionCooldownMs(rejectionCount: number): number {
  if (rejectionCount >= 5) return Infinity;
  return COOLDOWNS_MS[Math.max(0, rejectionCount - 1)];
}

export function rejectionRetrySeconds(rejectionCount: number, reviewedAt: Date, now = Date.now()): number {
  return Math.max(0, Math.ceil((reviewedAt.getTime() + rejectionCooldownMs(rejectionCount) - now) / 1000));
}

export function formatRetryWait(seconds: number): string {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  if (seconds === 60) return '1 minute';
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  const hours = Math.ceil(seconds / 3600);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}
