import rateLimit from 'express-rate-limit';
import redisService from '../services/redisService';

// General API rate limiter (100 requests per 15 minutes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Strict rate limiter for auth endpoints (5 requests per 15 minutes)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// OTP rate limiter (3 OTP requests per 5 minutes per phone/email)
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 OTP requests per windowMs
  message: {
    success: false,
    error: 'Too many OTP requests, please try again after 5 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Password reset rate limiter (3 requests per 15 minutes)
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Create task/event rate limiter (30 per minute)
export const createResourceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    error: 'Too many creation requests, please slow down',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// AI/Voice processing rate limiter (10 per minute - expensive operations)
export const aiProcessingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Too many AI processing requests, please wait a moment',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Custom rate limiter using Redis for distributed systems
export const createRedisRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix: string;
}) => {
  return async (req: any, res: any, next: any) => {
    try {
      const identifier = req.ip || req.connection.remoteAddress || 'unknown';
      const key = `${options.keyPrefix}:${identifier}`;

      // Get current count
      const currentCountStr = await redisService.get(key);
      const currentCount = currentCountStr ? parseInt(currentCountStr) : 0;

      if (currentCount >= options.max) {
        return res.status(429).json({
          success: false,
          error: options.message,
        });
      }

      // Increment count
      const newCount = currentCount + 1;
      await redisService.set(key, newCount.toString(), Math.ceil(options.windowMs / 1000));

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', options.max - newCount);
      res.setHeader('X-RateLimit-Reset', Date.now() + options.windowMs);

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // If Redis fails, allow the request (fail open)
      next();
    }
  };
};

// User-specific rate limiter (requires authentication)
export const userRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
}) => {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.userId || req.userId;

      if (!userId) {
        // If not authenticated, skip user-specific rate limiting
        return next();
      }

      const key = `user-rate:${userId}`;
      const currentCountStr = await redisService.get(key);
      const currentCount = currentCountStr ? parseInt(currentCountStr) : 0;

      if (currentCount >= options.max) {
        return res.status(429).json({
          success: false,
          error: options.message,
        });
      }

      const newCount = currentCount + 1;
      await redisService.set(key, newCount.toString(), Math.ceil(options.windowMs / 1000));

      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', options.max - newCount);

      next();
    } catch (error) {
      console.error('User rate limiter error:', error);
      next();
    }
  };
};