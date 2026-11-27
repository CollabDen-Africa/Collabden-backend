const { publisherClient } = require("../config/redis");

// If Redis is slow or down, let the request through rather than block users.
const REDIS_TIMEOUT_MS = 500;

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Rate limit check timed out")), REDIS_TIMEOUT_MS)),
  ]);

/**
 * Per-user fixed-window rate limiter backed by Redis. Must run after authMiddleware.
 * Routes that share a `name` share one budget.
 *
 * @param {{ name: string, max: number, windowSeconds: number }} options
 */
const rateLimitPerUser = ({ name, max, windowSeconds }) => async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next();

  const key = `ratelimit:${name}:${userId}`;

  try {
    const [[, count], [, ttl]] = await withTimeout(
      publisherClient.multi().incr(key).ttl(key).exec()
    );

    // First hit in the window (or a key left without expiry) starts the window.
    if (count === 1 || ttl === -1) {
      await withTimeout(publisherClient.expire(key, windowSeconds));
    }

    if (count > max) {
      const retryAfter = ttl > 0 ? ttl : windowSeconds;
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
        retryAfter,
      });
    }
  } catch (error) {
    console.error(`[RateLimit] ${name} check failed, allowing request:`, error.message);
  }

  return next();
};

module.exports = { rateLimitPerUser };
