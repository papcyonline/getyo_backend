# Backend Improvements Installation Guide

## New Dependencies to Install

Run the following command to install all new dependencies:

```bash
npm install redis ioredis express-rate-limit joi @sentry/node compression
```

Or if you encounter permission issues, run:

```bash
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install redis ioredis express-rate-limit joi @sentry/node compression
```

## Install and Configure Redis

### macOS (using Homebrew):
```bash
brew install redis
brew services start redis
```

### Linux (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Docker:
```bash
docker run --name yo-redis -p 6379:6379 -d redis:latest
```

### Verify Redis is running:
```bash
redis-cli ping
# Should respond with: PONG
```

## Update Environment Variables

Add these new variables to your `.env` file:

```env
# Redis (for OTP storage and token blacklist)
REDIS_URL=redis://localhost:6379

# Sentry Error Monitoring (Optional - get DSN from sentry.io)
SENTRY_DSN=your-sentry-dsn-here

# Anthropic API (Claude AI)
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

## Setup Sentry (Optional but Recommended for Production)

1. Create a free account at https://sentry.io
2. Create a new project (select Node.js)
3. Copy the DSN (Data Source Name)
4. Add it to your `.env` file as `SENTRY_DSN`

## Features Added

### 1. **Redis Integration**
- Replaces in-memory OTP storage
- Token blacklist for secure logout
- Automatic fallback to in-memory if Redis unavailable
- File: `src/services/redisService.ts`

### 2. **Rate Limiting**
- General API: 100 requests/15 min
- Auth endpoints: 5 requests/15 min
- OTP requests: 3 requests/5 min
- Password reset: 3 requests/15 min
- AI processing: 10 requests/1 min
- File: `src/middleware/rateLimiter.ts`

### 3. **Request Validation (Joi)**
- Schema validation for all endpoints
- Custom error messages
- Type-safe validation
- File: `src/middleware/validation.ts`

### 4. **Token Blacklist**
- Tokens are blacklisted on logout
- Checked on every authenticated request
- Auto-expires based on token TTL
- Updated: `src/middleware/auth.ts`

### 5. **Sentry Error Monitoring**
- Automatic error tracking
- Performance monitoring
- User context tracking
- Custom breadcrumbs
- File: `src/services/sentryService.ts`

## Testing the Improvements

### Test Redis Connection:
```bash
npm run dev
# Check console for: ✅ Redis connected successfully
```

### Test Rate Limiting:
```bash
# Make rapid requests to any endpoint
for i in {1..10}; do curl http://localhost:3000/health; done
# Should see 429 status after hitting the limit
```

### Test OTP with Redis:
```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/send-phone-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'

# Check Redis
redis-cli keys "otp:*"
redis-cli get "otp:+1234567890"
```

### Test Token Blacklist:
```bash
# Login and get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Logout (blacklists token)
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"

# Try using the same token (should fail)
curl http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should return: {"success": false, "error": "Token has been revoked"}
```

## Production Checklist

- [ ] Redis running and accessible
- [ ] Sentry DSN configured
- [ ] Rate limits adjusted for production load
- [ ] Redis persistence configured (AOF or RDB)
- [ ] Redis password set (REQUIREPASS)
- [ ] Monitoring alerts configured
- [ ] Backup strategy for Redis data

## Troubleshooting

### Redis connection fails:
```bash
# Check if Redis is running
redis-cli ping

# Check Redis logs
tail -f /usr/local/var/log/redis.log  # macOS
journalctl -u redis-server -f         # Linux

# Test connection
redis-cli
> set test "hello"
> get test
```

### Rate limiting not working:
- Check if requests are coming from the same IP
- Verify rate limiter middleware is applied
- Check console logs for errors

### Validation errors:
- Check request body matches schema
- Review validation error details in response
- Verify Content-Type header is set

## Rollback Plan

If issues occur, you can temporarily disable new features:

1. **Disable Redis**: The system will automatically fallback to in-memory storage
2. **Disable Rate Limiting**: Comment out rate limiter middleware in routes
3. **Disable Validation**: Comment out validation middleware in routes
4. **Disable Sentry**: Remove SENTRY_DSN from .env

The system is designed to gracefully degrade if any service is unavailable.