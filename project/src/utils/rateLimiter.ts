const attempts: Record<string, number[]> = {};

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (!attempts[key]) attempts[key] = [];

  attempts[key] = attempts[key].filter((t) => now - t < windowMs);

  if (attempts[key].length >= maxAttempts) {
    const oldest = attempts[key][0];
    const retryAfterMs = windowMs - (now - oldest);
    return { allowed: false, retryAfterMs };
  }

  attempts[key].push(now);
  return { allowed: true, retryAfterMs: 0 };
}

export function formatRetryTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds <= 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}min`;
}
