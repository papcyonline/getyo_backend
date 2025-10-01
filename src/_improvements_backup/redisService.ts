import Redis from 'ioredis';

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private useInMemoryFallback: boolean = false;
  private inMemoryStore: Map<string, { value: string; expiry: number }> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Try to connect to Redis
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
        enableReadyCheck: true,
      });

      await this.client.connect();

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
        this.useInMemoryFallback = false;
      });

      this.client.on('error', (error) => {
        console.error('❌ Redis connection error:', error.message);
        this.isConnected = false;
        this.useInMemoryFallback = true;
      });

      this.client.on('close', () => {
        console.log('⚠️ Redis connection closed');
        this.isConnected = false;
        this.useInMemoryFallback = true;
      });

    } catch (error) {
      console.error('⚠️ Redis initialization failed, using in-memory fallback:', error instanceof Error ? error.message : error);
      this.useInMemoryFallback = true;
      this.isConnected = false;
    }
  }

  // OTP Storage
  async setOTP(identifier: string, code: string, expiryMinutes: number = 10): Promise<boolean> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        // Fallback to in-memory storage
        const expiryTime = Date.now() + expiryMinutes * 60 * 1000;
        this.inMemoryStore.set(identifier, {
          value: JSON.stringify({ code, expires: new Date(expiryTime), attempts: 0 }),
          expiry: expiryTime
        });
        return true;
      }

      const otpData = {
        code,
        expires: new Date(Date.now() + expiryMinutes * 60 * 1000),
        attempts: 0
      };

      await this.client.setex(
        `otp:${identifier}`,
        expiryMinutes * 60,
        JSON.stringify(otpData)
      );

      return true;
    } catch (error) {
      console.error('Error setting OTP:', error);
      // Fallback to in-memory
      this.useInMemoryFallback = true;
      return this.setOTP(identifier, code, expiryMinutes);
    }
  }

  async getOTP(identifier: string): Promise<{ code: string; expires: Date; attempts: number } | null> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        // Fallback to in-memory storage
        this.cleanupExpiredInMemory();
        const stored = this.inMemoryStore.get(identifier);
        if (!stored) return null;

        if (Date.now() > stored.expiry) {
          this.inMemoryStore.delete(identifier);
          return null;
        }

        return JSON.parse(stored.value);
      }

      const data = await this.client.get(`otp:${identifier}`);
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      console.error('Error getting OTP:', error);
      this.useInMemoryFallback = true;
      return this.getOTP(identifier);
    }
  }

  async updateOTPAttempts(identifier: string, attempts: number): Promise<boolean> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        // Fallback to in-memory storage
        const stored = this.inMemoryStore.get(identifier);
        if (!stored) return false;

        const data = JSON.parse(stored.value);
        data.attempts = attempts;
        this.inMemoryStore.set(identifier, {
          ...stored,
          value: JSON.stringify(data)
        });
        return true;
      }

      const data = await this.getOTP(identifier);
      if (!data) return false;

      data.attempts = attempts;
      const ttl = await this.client.ttl(`otp:${identifier}`);

      if (ttl > 0) {
        await this.client.setex(
          `otp:${identifier}`,
          ttl,
          JSON.stringify(data)
        );
      }

      return true;
    } catch (error) {
      console.error('Error updating OTP attempts:', error);
      return false;
    }
  }

  async deleteOTP(identifier: string): Promise<boolean> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        this.inMemoryStore.delete(identifier);
        return true;
      }

      await this.client.del(`otp:${identifier}`);
      return true;
    } catch (error) {
      console.error('Error deleting OTP:', error);
      return false;
    }
  }

  // Token Blacklist
  async blacklistToken(token: string, expirySeconds: number): Promise<boolean> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        const expiryTime = Date.now() + expirySeconds * 1000;
        this.inMemoryStore.set(`blacklist:${token}`, {
          value: 'blacklisted',
          expiry: expiryTime
        });
        return true;
      }

      await this.client.setex(`blacklist:${token}`, expirySeconds, 'blacklisted');
      return true;
    } catch (error) {
      console.error('Error blacklisting token:', error);
      return false;
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        this.cleanupExpiredInMemory();
        return this.inMemoryStore.has(`blacklist:${token}`);
      }

      const result = await this.client.get(`blacklist:${token}`);
      return result !== null;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false;
    }
  }

  // General key-value operations
  async set(key: string, value: string, expirySeconds?: number): Promise<boolean> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        const expiryTime = expirySeconds ? Date.now() + expirySeconds * 1000 : Number.MAX_SAFE_INTEGER;
        this.inMemoryStore.set(key, { value, expiry: expiryTime });
        return true;
      }

      if (expirySeconds) {
        await this.client.setex(key, expirySeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Error setting key:', error);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        this.cleanupExpiredInMemory();
        const stored = this.inMemoryStore.get(key);
        if (!stored || Date.now() > stored.expiry) {
          this.inMemoryStore.delete(key);
          return null;
        }
        return stored.value;
      }

      return await this.client.get(key);
    } catch (error) {
      console.error('Error getting key:', error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (this.useInMemoryFallback || !this.client || !this.isConnected) {
        this.inMemoryStore.delete(key);
        return true;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Error deleting key:', error);
      return false;
    }
  }

  // Cleanup expired in-memory entries
  private cleanupExpiredInMemory() {
    const now = Date.now();
    for (const [key, value] of this.inMemoryStore.entries()) {
      if (now > value.expiry) {
        this.inMemoryStore.delete(key);
      }
    }
  }

  // Health check
  async healthCheck(): Promise<{ connected: boolean; mode: string }> {
    if (this.useInMemoryFallback || !this.client || !this.isConnected) {
      return { connected: false, mode: 'in-memory-fallback' };
    }

    try {
      await this.client.ping();
      return { connected: true, mode: 'redis' };
    } catch (error) {
      return { connected: false, mode: 'in-memory-fallback' };
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
    this.inMemoryStore.clear();
  }
}

export default new RedisService();