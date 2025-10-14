import { Request, Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../types';

export const notificationController = {
  // Get all notifications for a user
  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { read, type, priority, limit = 50 } = req.query;

      let query: any = { userId };

      if (read !== undefined) query.read = read === 'true';
      if (type) query.type = type;
      if (priority) query.priority = priority;

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string));

      res.json({
        success: true,
        data: notifications,
        count: notifications.length,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications',
      });
    }
  },

  // Get unread notification count
  async getNotificationCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const count = await (Notification as any).getUnreadCount(userId);

      res.json({
        success: true,
        count,
      });
    } catch (error) {
      console.error('Error getting notification count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notification count',
      });
    }
  },

  // Create a notification (typically called by system, not user)
  async createNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const notificationData = {
        ...req.body,
        userId,
      };

      const notification = await (Notification as any).createNotification(notificationData);

      res.status(201).json({
        success: true,
        data: notification,
        message: 'Notification created successfully',
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notification',
      });
    }
  },

  // Mark a notification as read
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const notification = await Notification.findOne({ _id: id, userId });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      await notification.markAsRead();

      res.json({
        success: true,
        data: notification,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read',
      });
    }
  },

  // Mark all notifications as read
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const result = await (Notification as any).markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read',
      });
    }
  },

  // Delete a notification
  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const notification = await Notification.findOneAndDelete({ _id: id, userId });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification',
      });
    }
  },

  // Clear all read notifications
  async clearAllRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const result = await (Notification as any).deleteAllRead(userId);

      res.json({
        success: true,
        message: 'All read notifications cleared',
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error('Error clearing notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear notifications',
      });
    }
  },

  // Get recent notifications
  async getRecent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const limit = parseInt(req.query.limit as string) || 10;

      const notifications = await (Notification as any).getRecent(userId, limit);

      res.json({
        success: true,
        data: notifications,
        count: notifications.length,
      });
    } catch (error) {
      console.error('Error fetching recent notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent notifications',
      });
    }
  },
};
