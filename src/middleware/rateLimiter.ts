import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import RedisCacheService from '../services/RedisCacheService';

/**
 * API Rate Limiting Middleware
 *
 * Protects API endpoints from abuse with configurable rate limits
 * Uses Redis for distributed rate limiting when available
 */

// Get Redis client for rate limiting
const getRedisClient = () => {
  // @ts-ignore - accessing private client for rate limiting
  return RedisCacheService.isReady() ? RedisCacheService.client : null;
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use Redis store if available, otherwise use memory store
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore - Redis client is compatible
        client: getRedisClient(),
        prefix: 'ratelimit:general:',
      })
    : undefined,
});

/**
 * Authentication rate limiter
 * Development: 50 requests per 15 minutes per IP (lenient for testing)
 * Production: 5 requests per 15 minutes per IP (stricter for security)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // Lenient in dev, strict in prod
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore
        client: getRedisClient(),
        prefix: 'ratelimit:auth:',
      })
    : undefined,
});

/**
 * AI/OpenAI API rate limiter
 * 20 requests per minute per user (to control OpenAI costs)
 */
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each user to 20 AI requests per minute
  message: {
    success: false,
    error: 'AI request limit exceeded. Please wait a moment before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // No custom keyGenerator - uses default IP-based limiting
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore
        client: getRedisClient(),
        prefix: 'ratelimit:ai:',
      })
    : undefined,
});

/**
 * File upload rate limiter
 * 10 uploads per hour per user
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 uploads per hour
  message: {
    success: false,
    error: 'Upload limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // No custom keyGenerator - uses default IP-based limiting
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore
        client: getRedisClient(),
        prefix: 'ratelimit:upload:',
      })
    : undefined,
});

/**
 * Voice/Transcription rate limiter
 * 30 requests per hour per user
 */
export const voiceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each user to 30 voice requests per hour
  message: {
    success: false,
    error: 'Voice request limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // No custom keyGenerator - uses default IP-based limiting
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore
        client: getRedisClient(),
        prefix: 'ratelimit:voice:',
      })
    : undefined,
});

/**
 * Email/Communication rate limiter
 * 50 emails per day per user
 */
export const emailLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 50, // Limit each user to 50 emails per day
  message: {
    success: false,
    error: 'Daily email limit exceeded. Please try again tomorrow.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // No custom keyGenerator - uses default IP-based limiting
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore
        client: getRedisClient(),
        prefix: 'ratelimit:email:',
      })
    : undefined,
});

/**
 * Search rate limiter
 * 60 searches per minute per user
 */
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each user to 60 searches per minute
  message: {
    success: false,
    error: 'Search limit exceeded. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // No custom keyGenerator - uses default IP-based limiting
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore
        client: getRedisClient(),
        prefix: 'ratelimit:search:',
      })
    : undefined,
});

/**
 * Webhook rate limiter
 * 100 requests per minute (for external webhooks)
 */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: 'Webhook rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisClient()
    ? new RedisStore({
        // @ts-ignore
        client: getRedisClient(),
        prefix: 'ratelimit:webhook:',
      })
    : undefined,
});
