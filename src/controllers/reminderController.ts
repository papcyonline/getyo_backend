import { Request, Response } from 'express';
import Reminder from '../models/Reminder';
import { AuthRequest } from '../types';

export const reminderController = {
  // Get all reminders for a user
  async getReminders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { status, isUrgent } = req.query;

      let query: any = { userId };

      if (status) query.status = status;
      if (isUrgent !== undefined) query.isUrgent = isUrgent === 'true';

      const reminders = await Reminder.find(query).sort({ reminderTime: 1 });

      res.json({
        success: true,
        data: reminders,
        count: reminders.length,
      });
    } catch (error) {
      console.error('Error fetching reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reminders',
      });
    }
  },

  // Create a new reminder
  async createReminder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const reminderData = {
        ...req.body,
        userId,
      };

      const reminder = new Reminder(reminderData);
      await reminder.save();

      res.status(201).json({
        success: true,
        data: reminder,
        message: 'Reminder created successfully',
      });
    } catch (error) {
      console.error('Error creating reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create reminder',
      });
    }
  },

  // Update a reminder
  async updateReminder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const updates = req.body;

      delete updates.userId;

      const reminder = await Reminder.findOneAndUpdate(
        { _id: id, userId },
        updates,
        { new: true, runValidators: true }
      );

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      res.json({
        success: true,
        data: reminder,
        message: 'Reminder updated successfully',
      });
    } catch (error) {
      console.error('Error updating reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update reminder',
      });
    }
  },

  // Delete a reminder
  async deleteReminder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const reminder = await Reminder.findOneAndDelete({ _id: id, userId });

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      res.json({
        success: true,
        message: 'Reminder deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete reminder',
      });
    }
  },

  // Snooze a reminder
  async snoozeReminder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { minutes = 10 } = req.body;

      const reminder = await Reminder.findOne({ _id: id, userId });

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      await reminder.snooze(minutes);

      res.json({
        success: true,
        data: reminder,
        message: `Reminder snoozed for ${minutes} minutes`,
      });
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to snooze reminder',
      });
    }
  },

  // Toggle reminder status
  async toggleReminderStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
        });
      }

      const reminder = await Reminder.findOneAndUpdate(
        { _id: id, userId },
        { status },
        { new: true }
      );

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      res.json({
        success: true,
        data: reminder,
        message: 'Reminder status updated',
      });
    } catch (error) {
      console.error('Error toggling reminder status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update reminder status',
      });
    }
  },

  // Get upcoming reminders
  async getUpcomingReminders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const hours = parseInt(req.query.hours as string) || 24;

      const reminders = await (Reminder as any).getUpcomingReminders(userId, hours);

      res.json({
        success: true,
        data: reminders,
        count: reminders.length,
      });
    } catch (error) {
      console.error('Error fetching upcoming reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upcoming reminders',
      });
    }
  },

  // Get overdue reminders
  async getOverdueReminders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const reminders = await (Reminder as any).getOverdueReminders(userId);

      res.json({
        success: true,
        data: reminders,
        count: reminders.length,
      });
    } catch (error) {
      console.error('Error fetching overdue reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch overdue reminders',
      });
    }
  },
};