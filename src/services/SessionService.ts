import crypto from 'crypto';
import Session, { ISession } from '../models/Session';
import GeolocationService from './GeolocationService';

interface DeviceInfo {
  userAgent: string;
  ipAddress: string;
  deviceName?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'web';
  os?: string;
  browser?: string;
  appVersion?: string;
  platform?: string;
}

class SessionService {
  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse device type from user agent
   */
  private parseDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' | 'web' {
    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    if (ua.includes('electron') || ua.includes('windows') || ua.includes('macintosh')) {
      return 'desktop';
    }
    return 'web';
  }

  /**
   * Parse browser name from user agent
   */
  private parseBrowser(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Unknown Browser';
  }

  /**
   * Parse OS from user agent
   */
  private parseOS(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    return 'Unknown OS';
  }

  /**
   * Generate device name from user agent
   */
  private generateDeviceName(userAgent: string): string {
    const browser = this.parseBrowser(userAgent);
    const os = this.parseOS(userAgent);
    return `${browser} on ${os}`;
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    token: string,
    deviceInfo: DeviceInfo,
    expiryHours: number = 720 // 30 days default
  ): Promise<ISession> {
    try {
      // Hash the token for security
      const hashedToken = this.hashToken(token);

      // Get location from IP
      const location = await GeolocationService.getLocationFromIP(deviceInfo.ipAddress);

      // Parse device information
      const deviceType = deviceInfo.deviceType || this.parseDeviceType(deviceInfo.userAgent);
      const deviceName = deviceInfo.deviceName || this.generateDeviceName(deviceInfo.userAgent);
      const os = deviceInfo.os || this.parseOS(deviceInfo.userAgent);
      const browser = deviceInfo.browser || this.parseBrowser(deviceInfo.userAgent);

      // Calculate expiry date
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Create session - Mongoose will automatically convert userId string to ObjectId
      const session = new Session({
        userId,
        token: hashedToken,
        deviceName,
        deviceType,
        deviceInfo: {
          os,
          browser,
          appVersion: deviceInfo.appVersion,
          platform: deviceInfo.platform,
        },
        ipAddress: deviceInfo.ipAddress,
        location,
        userAgent: deviceInfo.userAgent,
        lastActive: new Date(),
        expiresAt,
        isActive: true,
      });

      await session.save();
      console.log(`✅ Session saved successfully for user: ${userId}`);
      return session;
    } catch (error: any) {
      console.error('❌ SessionService.createSession ERROR:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack,
        userId: userId,
        deviceInfo: {
          userAgent: deviceInfo.userAgent,
          ipAddress: deviceInfo.ipAddress,
        },
        // MongoDB duplicate key error details
        ...(error.code === 11000 && {
          duplicateKey: error.keyPattern,
          duplicateValue: error.keyValue,
        }),
      });
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<ISession[]> {
    try {
      return await (Session as any).getActiveSessions(userId);
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw new Error('Failed to get user sessions');
    }
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token: string): Promise<ISession | null> {
    try {
      const hashedToken = this.hashToken(token);
      const session = await Session.findOne({
        token: hashedToken,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });
      return session;
    } catch (error) {
      console.error('Error getting session by token:', error);
      return null;
    }
  }

  /**
   * Update session activity (last active timestamp)
   */
  async updateSessionActivity(token: string): Promise<ISession | null> {
    try {
      const hashedToken = this.hashToken(token);
      return await (Session as any).updateActivity(hashedToken);
    } catch (error) {
      console.error('Error updating session activity:', error);
      return null;
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId: string, userId: string): Promise<ISession> {
    try {
      return await (Session as any).terminateSession(sessionId, userId);
    } catch (error) {
      console.error('Error terminating session:', error);
      throw new Error('Failed to terminate session');
    }
  }

  /**
   * Terminate all other sessions (keep current)
   */
  async terminateAllOtherSessions(currentToken: string, userId: string): Promise<any> {
    try {
      const hashedToken = this.hashToken(currentToken);
      return await (Session as any).terminateAllOtherSessions(hashedToken, userId);
    } catch (error) {
      console.error('Error terminating all other sessions:', error);
      throw new Error('Failed to terminate all other sessions');
    }
  }

  /**
   * Terminate all sessions for a user (useful for password reset, account deletion)
   */
  async terminateAllUserSessions(userId: string): Promise<any> {
    try {
      const result = await Session.updateMany(
        { userId, isActive: true },
        { isActive: false, updatedAt: new Date() }
      );
      return result;
    } catch (error) {
      console.error('Error terminating all user sessions:', error);
      throw new Error('Failed to terminate all user sessions');
    }
  }

  /**
   * Cleanup expired sessions (can be run as a cron job)
   */
  async cleanupExpiredSessions(): Promise<any> {
    try {
      return await (Session as any).cleanupExpiredSessions();
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw new Error('Failed to cleanup expired sessions');
    }
  }

  /**
   * Validate if a session is active and valid
   */
  async validateSession(token: string): Promise<boolean> {
    try {
      const session = await this.getSessionByToken(token);
      return session ? session.isValid() : false;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  /**
   * Extend session expiry
   */
  async extendSession(token: string, hours: number = 24): Promise<ISession | null> {
    try {
      const session = await this.getSessionByToken(token);
      if (!session) return null;

      return await session.extendExpiry(hours);
    } catch (error) {
      console.error('Error extending session:', error);
      return null;
    }
  }

  /**
   * Get session count for a user
   */
  async getUserSessionCount(userId: string): Promise<number> {
    try {
      return await Session.countDocuments({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });
    } catch (error) {
      console.error('Error getting user session count:', error);
      return 0;
    }
  }
}

export default new SessionService();
