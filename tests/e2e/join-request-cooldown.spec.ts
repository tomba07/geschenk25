import { expect, test } from '@playwright/test';
import { rejectionCooldownMs, rejectionRetrySeconds, formatRetryWait } from '../../apps/api/src/utils/joinRequestCooldown';

test('rejection cooldown steps from ten seconds to a permanent block', () => {
  const seconds = [10, 900, 86400, 604800, Infinity, Infinity];
  seconds.forEach((seconds, index) => expect(rejectionCooldownMs(index + 1)).toBe(seconds * 1000));
  expect(rejectionCooldownMs(0)).toBe(10000);
});

test('cooldown expires at the boundary and polling does not extend it', () => {
  const reviewedAt = new Date('2026-10-28T00:00:00Z');
  const start = reviewedAt.getTime();
  expect(rejectionRetrySeconds(2, reviewedAt, start)).toBe(900);
  expect(rejectionRetrySeconds(2, reviewedAt, start + 60000)).toBe(840);
  expect(rejectionRetrySeconds(2, reviewedAt, start + 900000 - 1)).toBe(1);
  expect(rejectionRetrySeconds(2, reviewedAt, start + 900000)).toBe(0);
  expect(rejectionRetrySeconds(2, reviewedAt, start + 1000000)).toBe(0);
  expect(formatRetryWait(1)).toBe('1 second');
  expect(formatRetryWait(61)).toBe('2 minutes');
  expect(formatRetryWait(3600)).toBe('1 hour');
  expect(formatRetryWait(7200)).toBe('2 hours');
});
