/**
 * Personal Assistant Context Service
 * Provides comprehensive context about user data, integrations, settings, and system access
 * This gives the PA omniscient knowledge of everything in the app
 */

import { User } from '../models';
import Task from '../models/Task';
import Reminder from '../models/Reminder';
import Note from '../models/Note';
import Event from '../models/Event';
import Notification from '../models/Notification';

export interface PAContext {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    assistantName: string;
    assistantVoice?: string;
    profileImage?: string;
    preferences?: any;
  };
  currentData: {
    tasks: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
      overdue: number;
      dueToday: number;
      highPriority: number;
      recent: any[];
    };
    reminders: {
      total: number;
      active: number;
      completed: number;
      urgent: number;
      overdue: number;
      dueToday: number;
      recent: any[];
    };
    notes: {
      total: number;
      byCategory: {
        personal: number;
        work: number;
        idea: number;
        urgent: number;
      };
      recent: any[];
    };
    events: {
      total: number;
      upcoming: number;
      today: number;
      thisWeek: number;
      recent: any[];
    };
    notifications: {
      total: number;
      unread: number;
      recent: any[];
    };
  };
  integrations: {
    calendar: {
      google: { connected: boolean; email?: string };
      outlook: { connected: boolean; email?: string };
      apple: { connected: boolean };
    };
    email: {
      gmail: { connected: boolean; email?: string; unreadCount?: number };
      outlook: { connected: boolean; email?: string; unreadCount?: number };
      yahoo: { connected: boolean; email?: string; unreadCount?: number };
      icloud: { connected: boolean; email?: string; unreadCount?: number };
    };
    meetings: {
      zoom: { connected: boolean; email?: string };
      googleMeet: { connected: boolean; email?: string };
      teams: { connected: boolean; email?: string };
      webex: { connected: boolean; email?: string };
    };
  };
  analytics: {
    productivity: {
      tasksCompletedToday: number;
      tasksCompletedThisWeek: number;
      tasksCompletedThisMonth: number;
      averageCompletionTime?: string;
      completionRate: number;
    };
    activity: {
      totalConversations: number;
      messagesThisWeek: number;
      voiceInteractions: number;
      lastActive: string;
    };
  };
  systemAccess: {
    permissions: {
      contacts: boolean;
      calendar: boolean;
      notifications: boolean;
      location: boolean;
      camera: boolean;
      microphone: boolean;
    };
  };
}

class PAContextService {
  /**
   * Get comprehensive context for the PA
   */
  async getContext(userId: string): Promise<PAContext> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get all user data in parallel for performance
      const [
        tasks,
        reminders,
        notes,
        events,
        notifications,
      ] = await Promise.all([
        Task.find({ userId }),
        Reminder.find({ userId }),
        Note.find({ userId }),
        Event.find({ userId }),
        Notification.find({ userId }),
      ]);

      // Calculate task statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const taskStats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => {
          if (!t.dueDate) return false;
          const dueDate = new Date(t.dueDate);
          return dueDate < today && t.status !== 'completed';
        }).length,
        dueToday: tasks.filter(t => {
          if (!t.dueDate) return false;
          const dueDate = new Date(t.dueDate);
          const dueDateDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          return dueDateDay.getTime() === today.getTime() && t.status !== 'completed';
        }).length,
        highPriority: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
        recent: tasks.slice(-5).map(t => ({
          id: t._id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
        })),
      };

      // Calculate reminder statistics
      const reminderStats = {
        total: reminders.length,
        active: reminders.filter(r => r.status === 'active').length,
        completed: reminders.filter(r => r.status === 'completed').length,
        urgent: reminders.filter(r => r.isUrgent && r.status === 'active').length,
        overdue: reminders.filter(r => {
          const reminderTime = new Date(r.reminderTime);
          return reminderTime < now && r.status === 'active';
        }).length,
        dueToday: reminders.filter(r => {
          const reminderDate = new Date(r.reminderTime);
          const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
          return reminderDay.getTime() === today.getTime() && r.status === 'active';
        }).length,
        recent: reminders.slice(-5).map(r => ({
          id: r._id,
          title: r.title,
          reminderTime: r.reminderTime,
          isUrgent: r.isUrgent,
        })),
      };

      // Calculate note statistics
      const noteStats = {
        total: notes.length,
        byCategory: {
          personal: notes.filter(n => n.category === 'personal').length,
          work: notes.filter(n => n.category === 'work').length,
          idea: notes.filter(n => n.category === 'idea').length,
          urgent: notes.filter(n => n.category === 'urgent').length,
        },
        recent: notes.slice(-5).map(n => ({
          id: n._id,
          title: n.title,
          category: n.category,
          createdAt: n.createdAt,
        })),
      };

      // Calculate event statistics
      const eventStats = {
        total: events.length,
        upcoming: events.filter(e => new Date(e.startTime) > now).length,
        today: events.filter(e => {
          const eventDate = new Date(e.startTime);
          const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
          return eventDay.getTime() === today.getTime();
        }).length,
        thisWeek: events.filter(e => {
          const eventDate = new Date(e.startTime);
          const weekFromNow = new Date(now);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          return eventDate >= now && eventDate <= weekFromNow;
        }).length,
        recent: events.slice(-5).map(e => ({
          id: e._id,
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
        })),
      };

      // Calculate notification statistics
      const notificationStats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.read).length,
        recent: notifications.slice(-5).map(n => ({
          id: n._id,
          title: n.title,
          message: n.message,
          read: n.read,
        })),
      };

      // Get integration status
      const integrations = {
        calendar: {
          google: {
            connected: user.integrations?.googleCalendar?.connected || false,
            email: user.integrations?.googleCalendar?.email,
          },
          outlook: {
            connected: user.integrations?.outlookCalendar?.connected || false,
            email: user.integrations?.outlookCalendar?.email,
          },
          apple: {
            connected: user.integrations?.appleCalendar?.connected || false,
          },
        },
        email: {
          gmail: {
            connected: user.integrations?.gmail?.connected || false,
            email: user.integrations?.gmail?.email,
            unreadCount: user.integrations?.gmail?.unreadCount,
          },
          outlook: {
            connected: user.integrations?.outlook?.connected || false,
            email: user.integrations?.outlook?.email,
            unreadCount: user.integrations?.outlook?.unreadCount,
          },
          yahoo: {
            connected: user.integrations?.yahoo?.connected || false,
            email: user.integrations?.yahoo?.email,
            unreadCount: user.integrations?.yahoo?.unreadCount,
          },
          icloud: {
            connected: user.integrations?.icloud?.connected || false,
            email: user.integrations?.icloud?.email,
            unreadCount: user.integrations?.icloud?.unreadCount,
          },
        },
        meetings: {
          zoom: {
            connected: user.integrations?.zoom?.connected || false,
            email: user.integrations?.zoom?.email,
          },
          googleMeet: {
            connected: user.integrations?.googleMeet?.connected || false,
            email: user.integrations?.googleMeet?.email,
          },
          teams: {
            connected: user.integrations?.teams?.connected || false,
            email: user.integrations?.teams?.email,
          },
          webex: {
            connected: user.integrations?.webex?.connected || false,
            email: user.integrations?.webex?.email,
          },
        },
      };

      // Calculate productivity analytics
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const todayStart = new Date(today);
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - 1);

      const analytics = {
        productivity: {
          tasksCompletedToday: completedTasks.filter(t => {
            const completedDate = new Date(t.updatedAt || t.createdAt);
            return completedDate >= todayStart;
          }).length,
          tasksCompletedThisWeek: completedTasks.filter(t => {
            const completedDate = new Date(t.updatedAt || t.createdAt);
            return completedDate >= weekStart;
          }).length,
          tasksCompletedThisMonth: completedTasks.filter(t => {
            const completedDate = new Date(t.updatedAt || t.createdAt);
            return completedDate >= monthStart;
          }).length,
          averageCompletionTime: 'N/A', // Can be calculated if we track start/end times
          completionRate: taskStats.total > 0
            ? Math.round((taskStats.completed / taskStats.total) * 100)
            : 0,
        },
        activity: {
          totalConversations: 0, // Will be populated from Conversation model if needed
          messagesThisWeek: 0, // Will be populated from Conversation model if needed
          voiceInteractions: 0, // Will be populated from voice session data if needed
          lastActive: user.lastActive || new Date().toISOString(),
        },
      };

      // System permissions (will be enhanced based on actual permissions)
      const systemAccess = {
        permissions: {
          contacts: true,
          calendar: true,
          notifications: true,
          location: false,
          camera: false,
          microphone: true,
        },
      };

      return {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phoneNumber,
          assistantName: user.assistantName || 'Yo!',
          assistantVoice: user.assistantVoice,
          profileImage: user.profileImage,
          preferences: user.preferences,
        },
        currentData: {
          tasks: taskStats,
          reminders: reminderStats,
          notes: noteStats,
          events: eventStats,
          notifications: notificationStats,
        },
        integrations,
        analytics,
        systemAccess,
      };
    } catch (error) {
      console.error('Error getting PA context:', error);
      throw error;
    }
  }

  /**
   * Generate a natural language summary of the context
   */
  async getContextSummary(userId: string): Promise<string> {
    try {
      const context = await this.getContext(userId);

      const summary = `
CURRENT USER CONTEXT:

USER PROFILE:
- Name: ${context.user.name}
- Email: ${context.user.email}
- Assistant Name: ${context.user.assistantName}
- Voice: ${context.user.assistantVoice || 'Default'}

TASKS:
- Total: ${context.currentData.tasks.total}
- Pending: ${context.currentData.tasks.pending}
- In Progress: ${context.currentData.tasks.inProgress}
- Completed: ${context.currentData.tasks.completed}
- Due Today: ${context.currentData.tasks.dueToday}
- Overdue: ${context.currentData.tasks.overdue}
- High Priority: ${context.currentData.tasks.highPriority}

REMINDERS:
- Total: ${context.currentData.reminders.total}
- Active: ${context.currentData.reminders.active}
- Due Today: ${context.currentData.reminders.dueToday}
- Overdue: ${context.currentData.reminders.overdue}
- Urgent: ${context.currentData.reminders.urgent}

NOTES:
- Total: ${context.currentData.notes.total}
- Personal: ${context.currentData.notes.byCategory.personal}
- Work: ${context.currentData.notes.byCategory.work}
- Ideas: ${context.currentData.notes.byCategory.idea}
- Urgent: ${context.currentData.notes.byCategory.urgent}

CALENDAR EVENTS:
- Total: ${context.currentData.events.total}
- Today: ${context.currentData.events.today}
- This Week: ${context.currentData.events.thisWeek}
- Upcoming: ${context.currentData.events.upcoming}

NOTIFICATIONS:
- Total: ${context.currentData.notifications.total}
- Unread: ${context.currentData.notifications.unread}

INTEGRATIONS:
Calendar:
- Google Calendar: ${context.integrations.calendar.google.connected ? `Connected (${context.integrations.calendar.google.email})` : 'Not connected'}
- Outlook Calendar: ${context.integrations.calendar.outlook.connected ? `Connected (${context.integrations.calendar.outlook.email})` : 'Not connected'}
- Apple Calendar: ${context.integrations.calendar.apple.connected ? 'Connected' : 'Not connected'}

Email:
- Gmail: ${context.integrations.email.gmail.connected ? `Connected (${context.integrations.email.gmail.email}) - ${context.integrations.email.gmail.unreadCount || 0} unread` : 'Not connected'}
- Outlook: ${context.integrations.email.outlook.connected ? `Connected (${context.integrations.email.outlook.email}) - ${context.integrations.email.outlook.unreadCount || 0} unread` : 'Not connected'}
- Yahoo: ${context.integrations.email.yahoo.connected ? `Connected (${context.integrations.email.yahoo.email})` : 'Not connected'}
- iCloud: ${context.integrations.email.icloud.connected ? `Connected (${context.integrations.email.icloud.email})` : 'Not connected'}

Meetings:
- Zoom: ${context.integrations.meetings.zoom.connected ? `Connected (${context.integrations.meetings.zoom.email})` : 'Not connected'}
- Google Meet: ${context.integrations.meetings.googleMeet.connected ? `Connected (${context.integrations.meetings.googleMeet.email})` : 'Not connected'}
- Teams: ${context.integrations.meetings.teams.connected ? `Connected (${context.integrations.meetings.teams.email})` : 'Not connected'}
- Webex: ${context.integrations.meetings.webex.connected ? `Connected (${context.integrations.meetings.webex.email})` : 'Not connected'}

PRODUCTIVITY:
- Tasks Completed Today: ${context.analytics.productivity.tasksCompletedToday}
- Tasks Completed This Week: ${context.analytics.productivity.tasksCompletedThisWeek}
- Tasks Completed This Month: ${context.analytics.productivity.tasksCompletedThisMonth}
- Completion Rate: ${context.analytics.productivity.completionRate}%

Use this context to intelligently answer user questions and provide personalized assistance.
      `.trim();

      return summary;
    } catch (error) {
      console.error('Error generating context summary:', error);
      return 'Unable to retrieve context at this time.';
    }
  }
}

export default new PAContextService();
