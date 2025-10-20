/**
 * QUICK ACTIONS AGGREGATOR SERVICE
 *
 * This service aggregates and provides comprehensive data about all Quick Action screens:
 * 1. Chat with Assistant (conversation history)
 * 2. Quick Note (all notes)
 * 3. Add Task (all tasks)
 * 4. Set Reminder (all reminders)
 * 5. Latest Updates (notifications, assignments, completed items)
 *
 * The PA can query this service to answer questions like:
 * - "What's on my schedule today?"
 * - "Any upcoming activities tomorrow?"
 * - "What's in my latest updates?"
 * - "Show me my tasks"
 * - "What notes do I have?"
 */

import { User } from '../models';
import Task from '../models/Task';
import Reminder from '../models/Reminder';
import Note from '../models/Note';
import Event from '../models/Event';
import Notification from '../models/Notification';
import Conversation from '../models/Conversation';
import Assignment from '../models/Assignment';

export interface QuickActionsData {
  chat: {
    recentConversations: any[];
    totalConversations: number;
    lastConversation?: any;
    unreadMessages: number;
  };
  tasks: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    dueToday: number;
    dueTomorrow: number;
    dueThisWeek: number;
    highPriority: number;
    all: any[]; // All tasks with full details
    upcomingTasks: any[]; // Tasks due soon
  };
  reminders: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
    dueToday: number;
    dueTomorrow: number;
    dueThisWeek: number;
    urgent: number;
    all: any[]; // All reminders with full details
    upcomingReminders: any[]; // Reminders due soon
  };
  notes: {
    total: number;
    recent: any[];
    byCategory: {
      personal: any[];
      work: any[];
      idea: any[];
      urgent: any[];
    };
    all: any[]; // All notes
    todayNotes: any[]; // Notes created today
  };
  latestUpdates: {
    notifications: any[]; // Recent notifications
    completedAssignments: any[]; // PA's completed research
    completedTasks: any[]; // Recently completed tasks
    todayActivity: any[]; // All activity from today
    unreadCount: number;
  };
  upcomingActivities: {
    today: any[]; // Everything happening today
    tomorrow: any[]; // Everything happening tomorrow
    thisWeek: any[]; // Everything happening this week
    all: any[]; // All upcoming activities sorted by time
  };
  calendarEvents: {
    total: number;
    today: any[];
    tomorrow: any[];
    thisWeek: any[];
    all: any[];
  };
}

class QuickActionsAggregatorService {
  /**
   * ============================================================
   * MAIN AGGREGATION METHOD
   * ============================================================
   */
  async aggregateAllQuickActions(userId: string): Promise<QuickActionsData> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Fetch all data in parallel for performance
    const [
      conversations,
      tasks,
      reminders,
      notes,
      events,
      notifications,
      assignments,
      user
    ] = await Promise.all([
      Conversation.find({ userId }).sort({ updatedAt: -1 }).limit(20),
      Task.find({ userId }).sort({ createdAt: -1 }),
      Reminder.find({ userId }).sort({ reminderTime: 1 }),
      Note.find({ userId }).sort({ createdAt: -1 }),
      Event.find({ userId }).sort({ startTime: 1 }),
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(50),
      this.loadAssignments(userId),
      User.findById(userId)
    ]);

    // ==========================================
    // 1. CHAT DATA
    // ==========================================
    const chatData = {
      recentConversations: conversations.slice(0, 10).map(c => ({
        id: c._id,
        title: c.title,
        messageCount: c.messages.length,
        lastMessage: c.messages[c.messages.length - 1],
        updatedAt: c.updatedAt,
        createdAt: c.createdAt
      })),
      totalConversations: conversations.length,
      lastConversation: conversations[0] ? {
        id: conversations[0]._id,
        title: conversations[0].title,
        messageCount: conversations[0].messages.length,
        lastMessage: conversations[0].messages[conversations[0].messages.length - 1],
        updatedAt: conversations[0].updatedAt
      } : undefined,
      unreadMessages: 0 // Can be enhanced if you track read/unread
    };

    // ==========================================
    // 2. TASKS DATA
    // ==========================================
    const tasksData = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        return new Date(t.dueDate) < today;
      }).length,
      dueToday: tasks.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        const dueDate = new Date(t.dueDate);
        const dueDateDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return dueDateDay.getTime() === today.getTime();
      }).length,
      dueTomorrow: tasks.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        const dueDate = new Date(t.dueDate);
        const dueDateDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return dueDateDay.getTime() === tomorrow.getTime();
      }).length,
      dueThisWeek: tasks.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        const dueDate = new Date(t.dueDate);
        return dueDate >= today && dueDate < nextWeek;
      }).length,
      highPriority: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
      all: tasks.map(t => ({
        id: t._id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        createdBy: t.createdBy
      })),
      upcomingTasks: tasks
        .filter(t => t.dueDate && t.status !== 'completed')
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 10)
        .map(t => ({
          id: t._id,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status
        }))
    };

    // ==========================================
    // 3. REMINDERS DATA
    // ==========================================
    const remindersData = {
      total: reminders.length,
      active: reminders.filter(r => r.status === 'active').length,
      completed: reminders.filter(r => r.status === 'completed').length,
      overdue: reminders.filter(r => {
        if (r.status === 'completed') return false;
        return new Date(r.reminderTime) < now;
      }).length,
      dueToday: reminders.filter(r => {
        if (r.status === 'completed') return false;
        const reminderDate = new Date(r.reminderTime);
        const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
        return reminderDay.getTime() === today.getTime();
      }).length,
      dueTomorrow: reminders.filter(r => {
        if (r.status === 'completed') return false;
        const reminderDate = new Date(r.reminderTime);
        const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
        return reminderDay.getTime() === tomorrow.getTime();
      }).length,
      dueThisWeek: reminders.filter(r => {
        if (r.status === 'completed') return false;
        const reminderDate = new Date(r.reminderTime);
        return reminderDate >= today && reminderDate < nextWeek;
      }).length,
      urgent: reminders.filter(r => r.isUrgent && r.status === 'active').length,
      all: reminders.map(r => ({
        id: r._id,
        title: r.title,
        notes: r.notes,
        reminderTime: r.reminderTime,
        isUrgent: r.isUrgent,
        status: r.status,
        createdAt: r.createdAt
      })),
      upcomingReminders: reminders
        .filter(r => r.status === 'active')
        .slice(0, 10)
        .map(r => ({
          id: r._id,
          title: r.title,
          reminderTime: r.reminderTime,
          isUrgent: r.isUrgent
        }))
    };

    // ==========================================
    // 4. NOTES DATA
    // ==========================================
    const notesData = {
      total: notes.length,
      recent: notes.slice(0, 10).map(n => ({
        id: n._id,
        title: n.title,
        content: n.content.substring(0, 200), // First 200 chars
        category: n.category,
        tags: n.tags,
        createdAt: n.createdAt
      })),
      byCategory: {
        personal: notes.filter(n => n.category === 'personal').map(n => ({
          id: n._id,
          title: n.title,
          content: n.content.substring(0, 100),
          createdAt: n.createdAt
        })),
        work: notes.filter(n => n.category === 'work').map(n => ({
          id: n._id,
          title: n.title,
          content: n.content.substring(0, 100),
          createdAt: n.createdAt
        })),
        idea: notes.filter(n => n.category === 'idea').map(n => ({
          id: n._id,
          title: n.title,
          content: n.content.substring(0, 100),
          createdAt: n.createdAt
        })),
        urgent: notes.filter(n => n.category === 'urgent').map(n => ({
          id: n._id,
          title: n.title,
          content: n.content.substring(0, 100),
          createdAt: n.createdAt
        }))
      },
      all: notes.map(n => ({
        id: n._id,
        title: n.title,
        content: n.content,
        category: n.category,
        tags: n.tags,
        createdAt: n.createdAt
      })),
      todayNotes: notes.filter(n => {
        const noteDate = new Date(n.createdAt);
        const noteDay = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
        return noteDay.getTime() === today.getTime();
      }).map(n => ({
        id: n._id,
        title: n.title,
        content: n.content.substring(0, 100),
        category: n.category,
        createdAt: n.createdAt
      }))
    };

    // ==========================================
    // 5. LATEST UPDATES DATA
    // ==========================================
    const latestUpdatesData = {
      notifications: notifications.slice(0, 20).map(n => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority,
        read: n.read,
        createdAt: n.createdAt,
        relatedModel: n.relatedModel,
        relatedId: n.relatedId
      })),
      completedAssignments: assignments.filter((a: any) => a.status === 'completed').map((a: any) => ({
        id: a._id,
        title: a.title,
        type: a.type,
        findings: a.findings?.substring(0, 200), // First 200 chars
        completedAt: a.completedAt,
        createdAt: a.createdAt
      })),
      completedTasks: tasks.filter(t => {
        if (t.status !== 'completed') return false;
        const completedDate = new Date(t.updatedAt || t.createdAt);
        const daysDiff = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Completed in last 7 days
      }).map(t => ({
        id: t._id,
        title: t.title,
        completedAt: t.updatedAt,
        priority: t.priority
      })),
      todayActivity: this.getTodayActivity(tasks, reminders, notes, events, notifications, today),
      unreadCount: notifications.filter(n => !n.read).length
    };

    // ==========================================
    // 6. CALENDAR EVENTS DATA
    // ==========================================
    const calendarEventsData = {
      total: events.length,
      today: events.filter(e => {
        const eventDate = new Date(e.startTime);
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDay.getTime() === today.getTime();
      }).map(e => ({
        id: e._id,
        title: e.title,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        attendees: e.attendees,
        source: e.source
      })),
      tomorrow: events.filter(e => {
        const eventDate = new Date(e.startTime);
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDay.getTime() === tomorrow.getTime();
      }).map(e => ({
        id: e._id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location
      })),
      thisWeek: events.filter(e => {
        const eventDate = new Date(e.startTime);
        return eventDate >= today && eventDate < nextWeek;
      }).map(e => ({
        id: e._id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location
      })),
      all: events.map(e => ({
        id: e._id,
        title: e.title,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        attendees: e.attendees,
        source: e.source
      }))
    };

    // ==========================================
    // 7. UPCOMING ACTIVITIES (AGGREGATED)
    // ==========================================
    const upcomingActivitiesData = this.aggregateUpcomingActivities(
      tasksData,
      remindersData,
      calendarEventsData,
      today,
      tomorrow,
      nextWeek
    );

    return {
      chat: chatData,
      tasks: tasksData,
      reminders: remindersData,
      notes: notesData,
      latestUpdates: latestUpdatesData,
      upcomingActivities: upcomingActivitiesData,
      calendarEvents: calendarEventsData
    };
  }

  /**
   * ============================================================
   * HELPER METHODS
   * ============================================================
   */

  private async loadAssignments(userId: string): Promise<any[]> {
    try {
      const Assignment = (await import('../models/Assignment')).default;
      return await Assignment.find({ userId }).sort({ createdAt: -1 }).limit(20);
    } catch (error) {
      console.warn('Assignment model not available:', error);
      return [];
    }
  }

  private getTodayActivity(
    tasks: any[],
    reminders: any[],
    notes: any[],
    events: any[],
    notifications: any[],
    today: Date
  ): any[] {
    const activity: any[] = [];

    // Tasks created today
    tasks.forEach(task => {
      const taskDate = new Date(task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      if (taskDay.getTime() === today.getTime()) {
        activity.push({
          type: 'task_created',
          title: `Task created: ${task.title}`,
          time: task.createdAt,
          priority: task.priority,
          data: task
        });
      }
    });

    // Tasks completed today
    tasks.forEach(task => {
      if (task.status === 'completed') {
        const completedDate = new Date(task.updatedAt || task.createdAt);
        const completedDay = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
        if (completedDay.getTime() === today.getTime()) {
          activity.push({
            type: 'task_completed',
            title: `Task completed: ${task.title}`,
            time: task.updatedAt || task.createdAt,
            data: task
          });
        }
      }
    });

    // Reminders set for today
    reminders.forEach(reminder => {
      const reminderDate = new Date(reminder.reminderTime);
      const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
      if (reminderDay.getTime() === today.getTime()) {
        activity.push({
          type: 'reminder',
          title: `Reminder: ${reminder.title}`,
          time: reminder.reminderTime,
          isUrgent: reminder.isUrgent,
          data: reminder
        });
      }
    });

    // Notes created today
    notes.forEach(note => {
      const noteDate = new Date(note.createdAt);
      const noteDay = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
      if (noteDay.getTime() === today.getTime()) {
        activity.push({
          type: 'note_created',
          title: `Note: ${note.title}`,
          time: note.createdAt,
          category: note.category,
          data: note
        });
      }
    });

    // Events happening today
    events.forEach(event => {
      const eventDate = new Date(event.startTime);
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      if (eventDay.getTime() === today.getTime()) {
        activity.push({
          type: 'event',
          title: `Event: ${event.title}`,
          time: event.startTime,
          location: event.location,
          data: event
        });
      }
    });

    // Notifications from today
    notifications.forEach(notification => {
      const notificationDate = new Date(notification.createdAt);
      const notificationDay = new Date(notificationDate.getFullYear(), notificationDate.getMonth(), notificationDate.getDate());
      if (notificationDay.getTime() === today.getTime()) {
        activity.push({
          type: 'notification',
          title: notification.title,
          message: notification.message,
          time: notification.createdAt,
          priority: notification.priority,
          data: notification
        });
      }
    });

    // Sort by time (most recent first)
    return activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }

  private aggregateUpcomingActivities(
    tasksData: any,
    remindersData: any,
    calendarEventsData: any,
    today: Date,
    tomorrow: Date,
    nextWeek: Date
  ): any {
    const todayActivities: any[] = [];
    const tomorrowActivities: any[] = [];
    const thisWeekActivities: any[] = [];

    // Tasks due today
    tasksData.all.forEach((task: any) => {
      if (task.dueDate && task.status !== 'completed') {
        const dueDate = new Date(task.dueDate);
        const dueDateDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        if (dueDateDay.getTime() === today.getTime()) {
          todayActivities.push({
            type: 'task',
            category: 'deadline',
            title: task.title,
            time: task.dueDate,
            priority: task.priority,
            data: task
          });
        } else if (dueDateDay.getTime() === tomorrow.getTime()) {
          tomorrowActivities.push({
            type: 'task',
            category: 'deadline',
            title: task.title,
            time: task.dueDate,
            priority: task.priority,
            data: task
          });
        } else if (dueDate >= today && dueDate < nextWeek) {
          thisWeekActivities.push({
            type: 'task',
            category: 'deadline',
            title: task.title,
            time: task.dueDate,
            priority: task.priority,
            data: task
          });
        }
      }
    });

    // Reminders
    remindersData.all.forEach((reminder: any) => {
      if (reminder.status !== 'completed') {
        const reminderDate = new Date(reminder.reminderTime);
        const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());

        if (reminderDay.getTime() === today.getTime()) {
          todayActivities.push({
            type: 'reminder',
            category: 'alert',
            title: reminder.title,
            time: reminder.reminderTime,
            isUrgent: reminder.isUrgent,
            data: reminder
          });
        } else if (reminderDay.getTime() === tomorrow.getTime()) {
          tomorrowActivities.push({
            type: 'reminder',
            category: 'alert',
            title: reminder.title,
            time: reminder.reminderTime,
            isUrgent: reminder.isUrgent,
            data: reminder
          });
        } else if (reminderDate >= today && reminderDate < nextWeek) {
          thisWeekActivities.push({
            type: 'reminder',
            category: 'alert',
            title: reminder.title,
            time: reminder.reminderTime,
            isUrgent: reminder.isUrgent,
            data: reminder
          });
        }
      }
    });

    // Calendar events
    calendarEventsData.today.forEach((event: any) => {
      todayActivities.push({
        type: 'event',
        category: 'meeting',
        title: event.title,
        time: event.startTime,
        endTime: event.endTime,
        location: event.location,
        data: event
      });
    });

    calendarEventsData.tomorrow.forEach((event: any) => {
      tomorrowActivities.push({
        type: 'event',
        category: 'meeting',
        title: event.title,
        time: event.startTime,
        endTime: event.endTime,
        location: event.location,
        data: event
      });
    });

    calendarEventsData.thisWeek.forEach((event: any) => {
      thisWeekActivities.push({
        type: 'event',
        category: 'meeting',
        title: event.title,
        time: event.startTime,
        endTime: event.endTime,
        location: event.location,
        data: event
      });
    });

    // Sort all by time
    const sortByTime = (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime();

    todayActivities.sort(sortByTime);
    tomorrowActivities.sort(sortByTime);
    thisWeekActivities.sort(sortByTime);

    const allUpcoming = [
      ...todayActivities,
      ...tomorrowActivities,
      ...thisWeekActivities
    ].sort(sortByTime);

    return {
      today: todayActivities,
      tomorrow: tomorrowActivities,
      thisWeek: thisWeekActivities,
      all: allUpcoming
    };
  }

  /**
   * ============================================================
   * GENERATE NATURAL LANGUAGE SUMMARY
   * ============================================================
   */
  async generateQuickActionsSummary(userId: string): Promise<string> {
    const data = await this.aggregateAllQuickActions(userId);

    let summary = `QUICK ACTIONS DATA SUMMARY:\n\n`;

    // Chat
    summary += `💬 CHAT:\n`;
    summary += `- Total Conversations: ${data.chat.totalConversations}\n`;
    if (data.chat.lastConversation) {
      summary += `- Last Conversation: "${data.chat.lastConversation.title}" (${data.chat.lastConversation.messageCount} messages)\n`;
    }
    summary += `\n`;

    // Tasks
    summary += `📋 TASKS:\n`;
    summary += `- Total: ${data.tasks.total} (${data.tasks.pending} pending, ${data.tasks.inProgress} in progress, ${data.tasks.completed} completed)\n`;
    summary += `- Due Today: ${data.tasks.dueToday}\n`;
    summary += `- Due Tomorrow: ${data.tasks.dueTomorrow}\n`;
    summary += `- Due This Week: ${data.tasks.dueThisWeek}\n`;
    summary += `- Overdue: ${data.tasks.overdue}\n`;
    summary += `- High Priority: ${data.tasks.highPriority}\n`;
    if (data.tasks.upcomingTasks.length > 0) {
      summary += `- Next Up: ${data.tasks.upcomingTasks.slice(0, 3).map(t => `"${t.title}"`).join(', ')}\n`;
    }
    summary += `\n`;

    // Reminders
    summary += `⏰ REMINDERS:\n`;
    summary += `- Total: ${data.reminders.total} (${data.reminders.active} active, ${data.reminders.completed} completed)\n`;
    summary += `- Due Today: ${data.reminders.dueToday}\n`;
    summary += `- Due Tomorrow: ${data.reminders.dueTomorrow}\n`;
    summary += `- Due This Week: ${data.reminders.dueThisWeek}\n`;
    summary += `- Overdue: ${data.reminders.overdue}\n`;
    summary += `- Urgent: ${data.reminders.urgent}\n`;
    if (data.reminders.upcomingReminders.length > 0) {
      summary += `- Next Up: ${data.reminders.upcomingReminders.slice(0, 3).map(r => `"${r.title}"`).join(', ')}\n`;
    }
    summary += `\n`;

    // Notes
    summary += `📝 NOTES:\n`;
    summary += `- Total: ${data.notes.total}\n`;
    summary += `- By Category: Personal (${data.notes.byCategory.personal.length}), Work (${data.notes.byCategory.work.length}), Ideas (${data.notes.byCategory.idea.length}), Urgent (${data.notes.byCategory.urgent.length})\n`;
    summary += `- Created Today: ${data.notes.todayNotes.length}\n`;
    if (data.notes.recent.length > 0) {
      summary += `- Recent: ${data.notes.recent.slice(0, 3).map(n => `"${n.title}"`).join(', ')}\n`;
    }
    summary += `\n`;

    // Calendar Events
    summary += `📅 CALENDAR EVENTS:\n`;
    summary += `- Total: ${data.calendarEvents.total}\n`;
    summary += `- Today: ${data.calendarEvents.today.length}\n`;
    summary += `- Tomorrow: ${data.calendarEvents.tomorrow.length}\n`;
    summary += `- This Week: ${data.calendarEvents.thisWeek.length}\n`;
    if (data.calendarEvents.today.length > 0) {
      summary += `- Today's Events: ${data.calendarEvents.today.map(e => `"${e.title}" at ${new Date(e.startTime).toLocaleTimeString()}`).join(', ')}\n`;
    }
    summary += `\n`;

    // Latest Updates
    summary += `📰 LATEST UPDATES:\n`;
    summary += `- Unread Notifications: ${data.latestUpdates.unreadCount}\n`;
    summary += `- Completed Assignments (Research): ${data.latestUpdates.completedAssignments.length}\n`;
    summary += `- Recently Completed Tasks: ${data.latestUpdates.completedTasks.length}\n`;
    summary += `- Today's Activity: ${data.latestUpdates.todayActivity.length} items\n`;
    summary += `\n`;

    // Upcoming Activities
    summary += `🔜 UPCOMING ACTIVITIES:\n`;
    summary += `- Today: ${data.upcomingActivities.today.length} activities\n`;
    summary += `- Tomorrow: ${data.upcomingActivities.tomorrow.length} activities\n`;
    summary += `- This Week: ${data.upcomingActivities.thisWeek.length} activities\n`;

    if (data.upcomingActivities.today.length > 0) {
      summary += `\nTODAY'S SCHEDULE:\n`;
      data.upcomingActivities.today.forEach(activity => {
        const timeStr = new Date(activity.time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        summary += `- ${timeStr}: ${activity.title} (${activity.type})\n`;
      });
    }

    if (data.upcomingActivities.tomorrow.length > 0) {
      summary += `\nTOMORROW'S SCHEDULE:\n`;
      data.upcomingActivities.tomorrow.forEach(activity => {
        const timeStr = new Date(activity.time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        summary += `- ${timeStr}: ${activity.title} (${activity.type})\n`;
      });
    }

    return summary;
  }
}

export default new QuickActionsAggregatorService();
