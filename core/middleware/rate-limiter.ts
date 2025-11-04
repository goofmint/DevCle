/**
 * Rate Limiter Middleware
 *
 * Provides rate limiting for API endpoints to prevent abuse.
 * Uses Redis for distributed rate limiting across multiple instances.
 *
 * Key features:
 * - Per-user or per-IP rate limiting
 * - Configurable limits (requests per time window)
 * - Standard HTTP 429 responses with retry headers
 * - Multi-instance safe via Redis
 *
 * Usage:
 * ```typescript
 * await applyRateLimit(userId, ipAddress, limiterType);
 * ```
 */

import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';

/**
 * Redis client for rate limiting
 * Shared across all rate limiters
 */
const redis = process.env['REDIS_URL']
  ? new Redis(process.env['REDIS_URL'], {
      // Enable reconnection on failure
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Limit connection pool size
      maxRetriesPerRequest: 3,
    })
  : new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
      // Enable reconnection on failure
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Limit connection pool size
      maxRetriesPerRequest: 3,
    });

/**
 * Rate limiter for reprocess API
 * Default: 10 requests per minute per user
 */
const reprocessRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate_limit:reprocess',
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds (1 minute)
});

/**
 * Apply rate limit to a request
 *
 * Throws Response with 429 status if limit exceeded.
 * Uses authenticated user ID when available, falls back to IP address.
 *
 * @param userId - Authenticated user ID (null if not authenticated)
 * @param ip - Client IP address
 * @throws Response with 429 status and Retry-After header
 */
export async function applyRateLimit(userId: string | null, ip: string): Promise<void> {
  // Prefer authenticated user ID, fallback to IP
  const key = userId || `ip:${ip}`;

  try {
    await reprocessRateLimiter.consume(key);
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      // Calculate retry time in seconds
      const retryAfter = Math.ceil(error.msBeforeNext / 1000);

      // Throw Response with 429 status
      throw new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + error.msBeforeNext).toISOString(),
        },
      });
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Extract client IP from request headers
 *
 * Checks multiple headers in order of preference:
 * 1. X-Forwarded-For (first IP in chain)
 * 2. X-Real-IP
 * 3. Fallback to 'unknown'
 *
 * @param request - Remix request object
 * @returns Client IP address or 'unknown'
 */
export function getClientIp(request: Request): string {
  // Check X-Forwarded-For (may contain multiple IPs)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP in chain (client IP)
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // Check X-Real-IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return 'unknown';
}
