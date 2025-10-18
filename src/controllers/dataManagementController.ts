import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { User, Task, Event, Reminder, Note, Conversation, Session } from '../models';
import archiver from 'archiver';
import { Readable } from 'stream';

/**
 * Export all user data
 * @route POST /api/data-management/export
 */
export const exportUserData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    console.log('📦 Exporting data for user:', userId);

    // Fetch all user data
    const [user, tasks, events, reminders, notes, conversations, sessions] = await Promise.all([
      User.findById(userId).select('-password'),
      Task.find({ userId }),
      Event.find({ userId }),
      Reminder.find({ userId }),
      Note.find({ userId }),
      Conversation.find({ userId }),
      Session.find({ userId }),
    ]);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Prepare export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        country: user.country,
        language: user.language,
        timezone: user.timezone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tasks: tasks.map(task => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
      events: events.map(event => ({
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      })),
      reminders: reminders.map(reminder => ({
        title: reminder.title,
        notes: reminder.notes,
        reminderTime: reminder.reminderTime,
        repeatType: reminder.repeatType,
        isUrgent: reminder.isUrgent,
        status: reminder.status,
        createdAt: reminder.createdAt,
        updatedAt: reminder.updatedAt,
      })),
      notes: notes.map(note => ({
        title: note.title,
        content: note.content,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
      conversations: conversations.map(conv => ({
        messages: conv.messages,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      sessions: sessions.map(session => ({
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        location: session.location,
        ipAddress: session.ipAddress,
        lastActive: session.lastActive,
        createdAt: session.createdAt,
      })),
      statistics: {
        totalTasks: tasks.length,
        totalEvents: events.length,
        totalReminders: reminders.length,
        totalNotes: notes.length,
        totalConversations: conversations.length,
        totalSessions: sessions.length,
      },
    };

    // Format as JSON
    const format = req.body.format || 'json';

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="yo-data-export-${Date.now()}.json"`);
      res.json(exportData);
    } else if (format === 'zip') {
      // Create a ZIP archive
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="yo-data-export-${Date.now()}.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      // Add each data type as separate JSON files
      archive.append(JSON.stringify(exportData.user, null, 2), { name: 'user.json' });
      archive.append(JSON.stringify(exportData.tasks, null, 2), { name: 'tasks.json' });
      archive.append(JSON.stringify(exportData.events, null, 2), { name: 'events.json' });
      archive.append(JSON.stringify(exportData.reminders, null, 2), { name: 'reminders.json' });
      archive.append(JSON.stringify(exportData.notes, null, 2), { name: 'notes.json' });
      archive.append(JSON.stringify(exportData.conversations, null, 2), { name: 'conversations.json' });
      archive.append(JSON.stringify(exportData.sessions, null, 2), { name: 'sessions.json' });
      archive.append(JSON.stringify(exportData.statistics, null, 2), { name: 'statistics.json' });

      await archive.finalize();
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Supported formats: json, zip',
      });
    }

    console.log('✅ Data exported successfully for user:', userId);
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data',
    });
  }
};

/**
 * Get cache statistics
 * @route GET /api/data-management/cache/stats
 */
export const getCacheStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    console.log('📊 Getting cache stats for user:', userId);

    // Calculate cache sizes for user data
    const [tasks, events, reminders, notes, conversations, sessions] = await Promise.all([
      Task.find({ userId }),
      Event.find({ userId }),
      Reminder.find({ userId }),
      Note.find({ userId }),
      Conversation.find({ userId }),
      Session.find({ userId }),
    ]);

    // Estimate sizes (rough approximation in KB)
    const tasksCacheSize = (JSON.stringify(tasks).length / 1024).toFixed(2);
    const eventsCacheSize = (JSON.stringify(events).length / 1024).toFixed(2);
    const remindersCacheSize = (JSON.stringify(reminders).length / 1024).toFixed(2);
    const notesCacheSize = (JSON.stringify(notes).length / 1024).toFixed(2);
    const conversationsCacheSize = (JSON.stringify(conversations).length / 1024).toFixed(2);
    const sessionsCacheSize = (JSON.stringify(sessions).length / 1024).toFixed(2);

    const totalSize = (
      parseFloat(tasksCacheSize) +
      parseFloat(eventsCacheSize) +
      parseFloat(remindersCacheSize) +
      parseFloat(notesCacheSize) +
      parseFloat(conversationsCacheSize) +
      parseFloat(sessionsCacheSize)
    ).toFixed(2);

    const cacheStats = {
      totalSize: `${totalSize} KB`,
      breakdown: {
        tasks: `${tasksCacheSize} KB`,
        events: `${eventsCacheSize} KB`,
        reminders: `${remindersCacheSize} KB`,
        notes: `${notesCacheSize} KB`,
        conversations: `${conversationsCacheSize} KB`,
        sessions: `${sessionsCacheSize} KB`,
      },
      counts: {
        tasks: tasks.length,
        events: events.length,
        reminders: reminders.length,
        notes: notes.length,
        conversations: conversations.length,
        sessions: sessions.length,
      },
      lastUpdated: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: cacheStats,
    });

    console.log('✅ Cache stats retrieved for user:', userId);
  } catch (error) {
    console.error('Get cache stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
    });
  }
};

/**
 * Clear app cache (sessions and temporary data)
 * @route POST /api/data-management/cache/clear
 */
export const clearCache = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const currentToken = req.headers.authorization?.slice(7);
    console.log('🧹 Clearing cache for user:', userId);

    // Clear all sessions except the current one
    const result = await Session.deleteMany({
      userId,
      token: { $ne: currentToken },
    });

    console.log(`✅ Cache cleared for user ${userId}: ${result.deletedCount} sessions removed`);

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      data: {
        sessionsCleared: result.deletedCount,
      },
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
};

/**
 * Delete user account and all associated data
 * @route DELETE /api/data-management/account
 */
export const deleteAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { password, confirmDelete } = req.body;

    console.log('🗑️ Account deletion requested for user:', userId);

    // Validate confirmation
    if (confirmDelete !== 'DELETE MY ACCOUNT') {
      res.status(400).json({
        success: false,
        error: 'Please type "DELETE MY ACCOUNT" to confirm',
      });
      return;
    }

    // Verify password
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid password',
      });
      return;
    }

    // Delete all user data
    await Promise.all([
      Task.deleteMany({ userId }),
      Event.deleteMany({ userId }),
      Reminder.deleteMany({ userId }),
      Note.deleteMany({ userId }),
      Conversation.deleteMany({ userId }),
      Session.deleteMany({ userId }),
      User.findByIdAndDelete(userId),
    ]);

    console.log('✅ Account and all data deleted for user:', userId);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
    });
  }
};
