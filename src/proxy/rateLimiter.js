/**
 * Sliding Window Counter Rate Limiter for Cloudflare Workers
 */
export async function checkRateLimit(env, key, limit, windowSeconds = 60) {
  if (!env || !env.USERS_KV) return { allowed: true, remaining: limit, reset: 0, limit };

  const now = Math.floor(Date.now() / 1000);
  const currentWindowKey = `rl:${key}:${Math.floor(now / windowSeconds)}`;

  try {
    const rawCount = await env.USERS_KV.get(currentWindowKey);
    const count = rawCount ? parseInt(rawCount, 10) : 0;

    if (count >= limit) {
      const reset = windowSeconds - (now % windowSeconds);
      return { allowed: false, remaining: 0, reset, limit };
    }

    // Increment count for current window
    await env.USERS_KV.put(currentWindowKey, (count + 1).toString(), {
      expirationTtl: windowSeconds * 2
    });

    return { 
      allowed: true, 
      remaining: limit - (count + 1), 
      reset: windowSeconds - (now % windowSeconds),
      limit 
    };
  } catch (err) {
    console.error("[RateLimiter] KV error:", err.message || err);
    // Fail open if KV encounters storage errors
    return { allowed: true, remaining: 1, reset: 0, limit };
  }
}
