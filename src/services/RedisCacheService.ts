import Redis from 'ioredis';
import logger from '../utils/logger';

/**
 * Redis Cache Service
 *
 * Provides intelligent caching layer for frequently accessed data:
 * - User profiles
 * - Conversations
 * - Tasks, Reminders, Events
 * - API responses
 * - Session data
 */

class RedisCacheService {
  private client: Redis | null = null;
  private isConnected = false;
  private isEnabled = false;

  // Cache TTLs (in seconds)
  private readonly TTL = {
    USER_PROFILE: 60 * 15, // 15 minutes
    CONVERSATION: 60 * 10, // 10 minutes
    TASKS: 60 * 5, // 5 minutes
    REMINDERS: 60 * 5, // 5 minutes
    EVENTS: 60 * 10, // 10 minutes
    NOTIFICATIONS: 60 * 3, // 3 minutes
    PATTERNS: 60 * 15, // 15 minutes
    API_RESPONSE: 60 * 2, // 2 minutes
    SESSION: 60 * 60 * 24, // 24 hours
    QUICK_ACTIONS: 60 * 5, // 5 minutes
  };

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    try {
      // Check if Redis is enabled
      const redisUrl = process.env.REDIS_URL;
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379');
      const redisPassword = process.env.REDIS_PASSWORD;

      // Skip Redis if not configured
      if (!redisUrl && !process.env.REDIS_HOST) {
        logger.warn('[RedisCache] Redis not configured. Caching disabled.');
        this.isEnabled = false;
        return;
      }

      // Create Redis client
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.error('[RedisCache] Max retry attempts reached');
              return null; // Stop retrying
            }
            return Math.min(times * 100, 3000); // Exponential backoff
          },
        });
      } else {
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.error('[RedisCache] Max retry attempts reached');
              return null;
            }
            return Math.min(times * 100, 3000);
          },
        });
      }

      // Event listeners
      this.client.on('connect', () => {
        logger.info('[RedisCache] ✅ Connected to Redis');
        this.isConnected = true;
        this.isEnabled = true;
      });

      this.client.on('error', (error) => {
        logger.error('[RedisCache] ❌ Redis error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('[RedisCache] Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('[RedisCache] Reconnecting to Redis...');
      });

      // Wait for connection
      await this.client.ping();
      logger.info('[RedisCache] Redis cache service initialized');
    } catch (error) {
      logger.error('[RedisCache] Failed to initialize Redis:', error);
      this.isEnabled = false;
      this.isConnected = false;
      // Don't throw - app should continue without Redis
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('[RedisCache] Disconnected from Redis');
    }
  }

  /**
   * Check if caching is enabled and connected
   */
  isReady(): boolean {
    return this.isEnabled && this.isConnected && this.client !== null;
  }

  /**
   * Generic get method
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady()) return null;

    try {
      const data = await this.client!.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`[RedisCache] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Generic set method
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      const serialized = JSON.stringify(value);

      if (ttl) {
        await this.client!.setex(key, ttl, serialized);
      } else {
        await this.client!.set(key, serialized);
      }

      return true;
    } catch (error) {
      logger.error(`[RedisCache] Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      logger.error(`[RedisCache] Error deleting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isReady()) return 0;

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client!.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error(`[RedisCache] Error deleting pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Cache user profile
   */
  async cacheUser(userId: string, userData: any): Promise<boolean> {
    return this.set(`user:${userId}`, userData, this.TTL.USER_PROFILE);
  }

  /**
   * Get cached user profile
   */
  async getUser(userId: string): Promise<any | null> {
    return this.get(`user:${userId}`);
  }

  /**
   * Invalidate user cache
   */
  async invalidateUser(userId: string): Promise<boolean> {
    return this.delete(`user:${userId}`);
  }

  /**
   * Cache conversation
   */
  async cacheConversation(conversationId: string, conversationData: any): Promise<boolean> {
    return this.set(`conversation:${conversationId}`, conversationData, this.TTL.CONVERSATION);
  }

  /**
   * Get cached conversation
   */
  async getConversation(conversationId: string): Promise<any | null> {
    return this.get(`conversation:${conversationId}`);
  }

  /**
   * Invalidate conversation cache
   */
  async invalidateConversation(conversationId: string): Promise<boolean> {
    return this.delete(`conversation:${conversationId}`);
  }

  /**
   * Cache user's tasks list
   */
  async cacheUserTasks(userId: string, tasks: any[]): Promise<boolean> {
    return this.set(`tasks:user:${userId}`, tasks, this.TTL.TASKS);
  }

  /**
   * Get cached user tasks
   */
  async getUserTasks(userId: string): Promise<any[] | null> {
    return this.get(`tasks:user:${userId}`);
  }

  /**
   * Invalidate user tasks cache
   */
  async invalidateUserTasks(userId: string): Promise<boolean> {
    return this.delete(`tasks:user:${userId}`);
  }

  /**
   * Cache user's reminders list
   */
  async cacheUserReminders(userId: string, reminders: any[]): Promise<boolean> {
    return this.set(`reminders:user:${userId}`, reminders, this.TTL.REMINDERS);
  }

  /**
   * Get cached user reminders
   */
  async getUserReminders(userId: string): Promise<any[] | null> {
    return this.get(`reminders:user:${userId}`);
  }

  /**
   * Invalidate user reminders cache
   */
  async invalidateUserReminders(userId: string): Promise<boolean> {
    return this.delete(`reminders:user:${userId}`);
  }

  /**
   * Cache user's events list
   */
  async cacheUserEvents(userId: string, events: any[]): Promise<boolean> {
    return this.set(`events:user:${userId}`, events, this.TTL.EVENTS);
  }

  /**
   * Get cached user events
   */
  async getUserEvents(userId: string): Promise<any[] | null> {
    return this.get(`events:user:${userId}`);
  }

  /**
   * Invalidate user events cache
   */
  async invalidateUserEvents(userId: string): Promise<boolean> {
    return this.delete(`events:user:${userId}`);
  }

  /**
   * Cache user's notifications
   */
  async cacheUserNotifications(userId: string, notifications: any[]): Promise<boolean> {
    return this.set(`notifications:user:${userId}`, notifications, this.TTL.NOTIFICATIONS);
  }

  /**
   * Get cached user notifications
   */
  async getUserNotifications(userId: string): Promise<any[] | null> {
    return this.get(`notifications:user:${userId}`);
  }

  /**
   * Invalidate user notifications cache
   */
  async invalidateUserNotifications(userId: string): Promise<boolean> {
    return this.delete(`notifications:user:${userId}`);
  }

  /**
   * Cache user's patterns
   */
  async cacheUserPatterns(userId: string, patterns: any[]): Promise<boolean> {
    return this.set(`patterns:user:${userId}`, patterns, this.TTL.PATTERNS);
  }

  /**
   * Get cached user patterns
   */
  async getUserPatterns(userId: string): Promise<any[] | null> {
    return this.get(`patterns:user:${userId}`);
  }

  /**
   * Invalidate user patterns cache
   */
  async invalidateUserPatterns(userId: string): Promise<boolean> {
    return this.delete(`patterns:user:${userId}`);
  }

  /**
   * Cache Quick Actions summary
   */
  async cacheQuickActions(userId: string, quickActions: any): Promise<boolean> {
    return this.set(`quickactions:user:${userId}`, quickActions, this.TTL.QUICK_ACTIONS);
  }

  /**
   * Get cached Quick Actions
   */
  async getQuickActions(userId: string): Promise<any | null> {
    return this.get(`quickactions:user:${userId}`);
  }

  /**
   * Invalidate Quick Actions cache
   */
  async invalidateQuickActions(userId: string): Promise<boolean> {
    return this.delete(`quickactions:user:${userId}`);
  }

  /**
   * Invalidate all user-related caches
   */
  async invalidateAllUserCaches(userId: string): Promise<number> {
    return this.deletePattern(`*:user:${userId}`);
  }

  /**
   * Clear all caches (use with caution!)
   */
  async clearAllCaches(): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      await this.client!.flushdb();
      logger.info('[RedisCache] ✅ All caches cleared');
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error clearing all caches:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.isReady()) {
      return {
        enabled: false,
        connected: false,
      };
    }

    try {
      const info = await this.client!.info('stats');
      const dbSize = await this.client!.dbsize();

      return {
        enabled: this.isEnabled,
        connected: this.isConnected,
        totalKeys: dbSize,
        info: info,
      };
    } catch (error) {
      logger.error('[RedisCache] Error getting stats:', error);
      return {
        enabled: this.isEnabled,
        connected: this.isConnected,
        error: 'Failed to get stats',
      };
    }
  }
}

export default new RedisCacheService();
