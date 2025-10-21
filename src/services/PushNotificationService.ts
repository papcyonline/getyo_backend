import logger from '../utils/logger';
import Notification from '../models/Notification';

/**
 * Push Notification Service
 *
 * Handles sending push notifications to mobile devices
 * Supports FCM (Firebase Cloud Messaging) and APNS (Apple Push Notification Service)
 *
 * Setup Instructions:
 * 1. Install firebase-admin: npm install firebase-admin
 * 2. Download service account JSON from Firebase Console
 * 3. Set FIREBASE_SERVICE_ACCOUNT_PATH environment variable
 * 4. Set FIREBASE_DATABASE_URL environment variable
 */

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
  sound?: string;
  badge?: number;
}

class PushNotificationService {
  private isEnabled = false;
  private fcmApp: any = null;

  /**
   * Initialize push notification service
   */
  async initialize(): Promise<void> {
    try {
      // Check if using Expo Push (simpler, no Firebase needed)
      const useExpoPush = process.env.USE_EXPO_PUSH === 'true';

      if (useExpoPush) {
        logger.info('[PushNotification] ✅ Using Expo Push Notification Service (no Firebase needed)');
        this.isEnabled = true;
        return;
      }

      // Otherwise use Firebase
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const databaseURL = process.env.FIREBASE_DATABASE_URL;

      if (!serviceAccountPath || !databaseURL) {
        logger.warn('[PushNotification] Firebase not configured. Push notifications disabled.');
        logger.info('[PushNotification] 💡 Tip: Set USE_EXPO_PUSH=true in .env to use Expo Push instead');
        this.isEnabled = false;
        return;
      }

      // Dynamically import firebase-admin (optional dependency)
      const admin = await import('firebase-admin');
      const serviceAccount = require(serviceAccountPath);

      this.fcmApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL,
      });

      this.isEnabled = true;
      logger.info('[PushNotification] ✅ Firebase Admin initialized');
    } catch (error) {
      logger.error('[PushNotification] Failed to initialize:', error);
      this.isEnabled = false;
      // Don't throw - app should continue without push notifications
    }
  }

  /**
   * Send push notification to a single device
   */
  async sendToDevice(
    deviceToken: string,
    payload: PushNotificationPayload,
    notificationId?: string
  ): Promise<boolean> {
    if (!this.isEnabled) {
      logger.warn('[PushNotification] Push notifications not enabled');
      return false;
    }

    try {
      // Use Expo Push if enabled
      if (process.env.USE_EXPO_PUSH === 'true') {
        const axios = (await import('axios')).default;

        const message = {
          to: deviceToken,
          sound: payload.sound || 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          priority: payload.priority || 'high',
          badge: payload.badge,
        };

        const response = await axios.post('https://exp.host/--/api/v2/push/send', message, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        logger.info(`[PushNotification] ✅ Expo Push sent to device: ${deviceToken.substring(0, 20)}...`);

        // Update notification delivery status
        if (notificationId) {
          await this.markAsDelivered(notificationId, deviceToken);
        }

        return true;
      }

      // Otherwise use Firebase Admin
      const admin = await import('firebase-admin');

      const message: any = {
        token: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        apns: {
          payload: {
            aps: {
              sound: payload.sound || 'default',
              badge: payload.badge,
            },
          },
        },
        android: {
          priority: payload.priority || 'high',
          notification: {
            sound: payload.sound || 'default',
            channelId: 'default',
          },
        },
      };

      const response = await admin.messaging().send(message);
      logger.info(`[PushNotification] ✅ Firebase sent to device: ${deviceToken.substring(0, 10)}...`);

      // Update notification delivery status
      if (notificationId) {
        await this.markAsDelivered(notificationId, deviceToken);
      }

      return true;
    } catch (error) {
      logger.error('[PushNotification] Error sending to device:', error);

      // Update notification delivery failure
      if (notificationId) {
        await this.markAsFailedDelivery(notificationId, deviceToken, (error as Error).message);
      }

      return false;
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendToMultipleDevices(
    deviceTokens: string[],
    payload: PushNotificationPayload,
    notificationId?: string
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.isEnabled) {
      return { successCount: 0, failureCount: deviceTokens.length };
    }

    try {
      const admin = await import('firebase-admin');

      const message: any = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        apns: {
          payload: {
            aps: {
              sound: payload.sound || 'default',
              badge: payload.badge,
            },
          },
        },
        android: {
          priority: payload.priority || 'high',
          notification: {
            sound: payload.sound || 'default',
            channelId: 'default',
          },
        },
      };

      const response = await (admin.messaging() as any).sendMulticast({
        tokens: deviceTokens,
        ...message,
      });

      logger.info(
        `[PushNotification] Sent to ${deviceTokens.length} devices: ` +
        `${response.successCount} success, ${response.failureCount} failures`
      );

      // Update notification delivery status
      if (notificationId) {
        if (response.successCount > 0) {
          await this.markAsDelivered(notificationId, deviceTokens[0]);
        }
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      logger.error('[PushNotification] Error sending to multiple devices:', error);
      return { successCount: 0, failureCount: deviceTokens.length };
    }
  }

  /**
   * Send push notification to topic subscribers
   */
  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload,
    notificationId?: string
  ): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const admin = await import('firebase-admin');

      const message: any = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      };

      await admin.messaging().send(message);
      logger.info(`[PushNotification] ✅ Sent to topic: ${topic}`);

      // Update notification delivery status
      if (notificationId) {
        await this.markAsDelivered(notificationId, `topic:${topic}`);
      }

      return true;
    } catch (error) {
      logger.error(`[PushNotification] Error sending to topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Mark notification as delivered
   */
  private async markAsDelivered(notificationId: string, deviceToken: string): Promise<void> {
    try {
      await Notification.findByIdAndUpdate(notificationId, {
        $set: {
          'metadata.deliveryStatus': 'delivered',
          'metadata.deliveredAt': new Date(),
          'metadata.deliveredTo': deviceToken,
        },
      });
    } catch (error) {
      logger.error('[PushNotification] Error marking as delivered:', error);
    }
  }

  /**
   * Mark notification as failed delivery
   */
  private async markAsFailedDelivery(
    notificationId: string,
    deviceToken: string,
    errorMessage: string
  ): Promise<void> {
    try {
      await Notification.findByIdAndUpdate(notificationId, {
        $set: {
          'metadata.deliveryStatus': 'failed',
          'metadata.failedAt': new Date(),
          'metadata.failureReason': errorMessage,
          'metadata.targetDevice': deviceToken,
        },
      });
    } catch (error) {
      logger.error('[PushNotification] Error marking as failed:', error);
    }
  }

  /**
   * Subscribe device to topic
   */
  async subscribeToTopic(deviceTokens: string[], topic: string): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const admin = await import('firebase-admin');
      await admin.messaging().subscribeToTopic(deviceTokens, topic);
      logger.info(`[PushNotification] Subscribed ${deviceTokens.length} devices to topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error(`[PushNotification] Error subscribing to topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe device from topic
   */
  async unsubscribeFromTopic(deviceTokens: string[], topic: string): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const admin = await import('firebase-admin');
      await admin.messaging().unsubscribeFromTopic(deviceTokens, topic);
      logger.info(`[PushNotification] Unsubscribed ${deviceTokens.length} devices from topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error(`[PushNotification] Error unsubscribing from topic ${topic}:`, error);
      return false;
    }
  }
}

export default new PushNotificationService();
