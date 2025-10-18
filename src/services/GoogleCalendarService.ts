import { calendar_v3, google } from 'googleapis';
import GoogleOAuthService from './GoogleOAuthService';
import User from '../models/User';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  recurrence?: string[];
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
}

interface CreateEventOptions {
  summary: string;
  description?: string;
  location?: string;
  start: string | Date;
  end: string | Date;
  attendees?: string[];
  reminders?: Array<{
    method: 'email' | 'popup';
    minutes: number;
  }>;
  recurrence?: string[];
  timeZone?: string;
}

class GoogleCalendarService {
  /**
   * Get Calendar client for user
   */
  private async getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
    const user = await User.findById(userId);
    if (!user || !user.integrations?.google?.accessToken) {
      throw new Error('Google account not connected');
    }

    const { accessToken, refreshToken, expiresAt } = user.integrations.google;

    // Check if token is expired
    if (expiresAt && GoogleOAuthService.isTokenExpired(expiresAt.getTime())) {
      console.log('🔄 Token expired, refreshing...');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Refresh token
      const tokens = await GoogleOAuthService.refreshAccessToken(refreshToken);

      // Update user's tokens
      user.integrations.google.accessToken = tokens.access_token;
      user.integrations.google.refreshToken = tokens.refresh_token || refreshToken;
      user.integrations.google.expiresAt = new Date(tokens.expiry_date);
      await user.save();

      return GoogleOAuthService.getCalendarClient(tokens.access_token, tokens.refresh_token);
    }

    return GoogleOAuthService.getCalendarClient(accessToken, refreshToken);
  }

  /**
   * Get user's calendar events
   */
  async getEvents(userId: string, options: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: string;
  } = {}): Promise<CalendarEvent[]> {
    try {
      const calendar = await this.getCalendarClient(userId);

      const {
        timeMin = new Date(),
        timeMax,
        maxResults = 50,
        singleEvents = true,
        orderBy = 'startTime',
      } = options;

      console.log(`📅 Fetching Google Calendar events for user ${userId}...`);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax?.toISOString(),
        maxResults,
        singleEvents,
        orderBy,
      });

      const events = (response.data.items || []).map(this.parseEvent);

      console.log(`✅ Fetched ${events.length} calendar events`);
      return events;
    } catch (error: any) {
      console.error('❌ Failed to fetch calendar events:', error.message);
      throw error;
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(userId: string, eventId: string): Promise<CalendarEvent> {
    try {
      const calendar = await this.getCalendarClient(userId);

      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      return this.parseEvent(response.data);
    } catch (error: any) {
      console.error('❌ Failed to fetch calendar event:', error.message);
      throw error;
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(userId: string, eventData: CreateEventOptions): Promise<CalendarEvent> {
    try {
      const calendar = await this.getCalendarClient(userId);

      const {
        summary,
        description,
        location,
        start,
        end,
        attendees,
        reminders,
        recurrence,
        timeZone = 'UTC',
      } = eventData;

      console.log(`📅 Creating calendar event: ${summary}...`);

      const event: calendar_v3.Schema$Event = {
        summary,
        description,
        location,
        start: {
          dateTime: typeof start === 'string' ? start : start.toISOString(),
          timeZone,
        },
        end: {
          dateTime: typeof end === 'string' ? end : end.toISOString(),
          timeZone,
        },
        attendees: attendees?.map(email => ({ email })),
        recurrence,
        reminders: reminders ? {
          useDefault: false,
          overrides: reminders,
        } : {
          useDefault: true,
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: attendees && attendees.length > 0 ? 'all' : 'none',
      });

      console.log(`✅ Event created: ${response.data.id}`);
      return this.parseEvent(response.data);
    } catch (error: any) {
      console.error('❌ Failed to create calendar event:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    userId: string,
    eventId: string,
    updates: Partial<CreateEventOptions>
  ): Promise<CalendarEvent> {
    try {
      const calendar = await this.getCalendarClient(userId);

      // Get existing event first
      const existingEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      // Merge updates
      const updatedEvent: calendar_v3.Schema$Event = {
        ...existingEvent.data,
        summary: updates.summary || existingEvent.data.summary,
        description: updates.description !== undefined ? updates.description : existingEvent.data.description,
        location: updates.location !== undefined ? updates.location : existingEvent.data.location,
      };

      if (updates.start) {
        updatedEvent.start = {
          dateTime: typeof updates.start === 'string' ? updates.start : updates.start.toISOString(),
          timeZone: updates.timeZone || 'UTC',
        };
      }

      if (updates.end) {
        updatedEvent.end = {
          dateTime: typeof updates.end === 'string' ? updates.end : updates.end.toISOString(),
          timeZone: updates.timeZone || 'UTC',
        };
      }

      if (updates.attendees) {
        updatedEvent.attendees = updates.attendees.map(email => ({ email }));
      }

      console.log(`📅 Updating calendar event: ${eventId}...`);

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId,
        requestBody: updatedEvent,
        sendUpdates: 'all',
      });

      console.log(`✅ Event updated: ${eventId}`);
      return this.parseEvent(response.data);
    } catch (error: any) {
      console.error('❌ Failed to update calendar event:', error.message);
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(userId: string, eventId: string): Promise<void> {
    try {
      const calendar = await this.getCalendarClient(userId);

      console.log(`📅 Deleting calendar event: ${eventId}...`);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all',
      });

      console.log(`✅ Event deleted: ${eventId}`);
    } catch (error: any) {
      console.error('❌ Failed to delete calendar event:', error.message);
      throw error;
    }
  }

  /**
   * Get upcoming events (next 7 days)
   */
  async getUpcomingEvents(userId: string, days: number = 7): Promise<CalendarEvent[]> {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + days);

    return this.getEvents(userId, {
      timeMin,
      timeMax,
      maxResults: 50,
    });
  }

  /**
   * Get events for today
   */
  async getTodayEvents(userId: string): Promise<CalendarEvent[]> {
    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date();
    timeMax.setHours(23, 59, 59, 999);

    return this.getEvents(userId, {
      timeMin,
      timeMax,
    });
  }

  /**
   * Search calendar events
   */
  async searchEvents(userId: string, query: string): Promise<CalendarEvent[]> {
    try {
      const calendar = await this.getCalendarClient(userId);

      console.log(`🔍 Searching calendar events: "${query}"...`);

      const response = await calendar.events.list({
        calendarId: 'primary',
        q: query,
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = (response.data.items || []).map(this.parseEvent);

      console.log(`✅ Found ${events.length} events matching "${query}"`);
      return events;
    } catch (error: any) {
      console.error('❌ Failed to search calendar events:', error.message);
      throw error;
    }
  }

  /**
   * Parse Google Calendar event to our format
   */
  private parseEvent(event: calendar_v3.Schema$Event): CalendarEvent {
    // Helper to convert null to undefined
    const clean = <T,>(val: T | null | undefined): T | undefined =>
      val === null ? undefined : val;

    // @ts-ignore - Google API types use null but we prefer undefined
    return {
      id: event.id!,
      summary: event.summary || 'Untitled Event',
      description: clean(event.description),
      location: clean(event.location),
      start: {
        dateTime: clean(event.start?.dateTime),
        date: clean(event.start?.date),
        timeZone: clean(event.start?.timeZone),
      },
      end: {
        dateTime: clean(event.end?.dateTime),
        date: clean(event.end?.date),
        timeZone: clean(event.end?.timeZone),
      },
      attendees: event.attendees?.map(a => ({
        email: a.email!,
        displayName: clean(a.displayName),
        responseStatus: clean(a.responseStatus),
      })),
      recurrence: clean(event.recurrence),
      reminders: event.reminders as any,
      status: clean(event.status),
      htmlLink: clean(event.htmlLink),
      created: clean(event.created),
      updated: clean(event.updated),
      creator: event.creator as any,
    } as CalendarEvent;
  }
}

export default new GoogleCalendarService();
