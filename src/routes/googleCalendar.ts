import express from 'express';
import GoogleCalendarService from '../services/GoogleCalendarService';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/google-calendar/events
 * @desc    Get user's calendar events
 * @access  Private
 */
router.get('/events', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { timeMin, timeMax, maxResults } = req.query;

    const options: any = {};

    if (timeMin) options.timeMin = new Date(timeMin as string);
    if (timeMax) options.timeMax = new Date(timeMax as string);
    if (maxResults) options.maxResults = parseInt(maxResults as string);

    const events = await GoogleCalendarService.getEvents(userId, options);

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
      },
    });
  } catch (error: any) {
    console.error('❌ Get calendar events failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch calendar events',
    });
  }
});

/**
 * @route   GET /api/google-calendar/events/:id
 * @desc    Get a single calendar event
 * @access  Private
 */
router.get('/events/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const event = await GoogleCalendarService.getEvent(userId, id);

    res.json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    console.error('❌ Get calendar event failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch calendar event',
    });
  }
});

/**
 * @route   POST /api/google-calendar/events
 * @desc    Create a new calendar event
 * @access  Private
 */
router.post('/events', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { summary, description, location, start, end, attendees, reminders, recurrence, timeZone } = req.body;

    if (!summary || !start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: summary, start, end',
      });
    }

    const event = await GoogleCalendarService.createEvent(userId, {
      summary,
      description,
      location,
      start,
      end,
      attendees,
      reminders,
      recurrence,
      timeZone,
    });

    res.json({
      success: true,
      data: event,
      message: 'Event created successfully',
    });
  } catch (error: any) {
    console.error('❌ Create calendar event failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create calendar event',
    });
  }
});

/**
 * @route   PUT /api/google-calendar/events/:id
 * @desc    Update a calendar event
 * @access  Private
 */
router.put('/events/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const updates = req.body;

    const event = await GoogleCalendarService.updateEvent(userId, id, updates);

    res.json({
      success: true,
      data: event,
      message: 'Event updated successfully',
    });
  } catch (error: any) {
    console.error('❌ Update calendar event failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update calendar event',
    });
  }
});

/**
 * @route   DELETE /api/google-calendar/events/:id
 * @desc    Delete a calendar event
 * @access  Private
 */
router.delete('/events/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await GoogleCalendarService.deleteEvent(userId, id);

    res.json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Delete calendar event failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete calendar event',
    });
  }
});

/**
 * @route   GET /api/google-calendar/upcoming
 * @desc    Get upcoming events (next 7 days)
 * @access  Private
 */
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { days } = req.query;

    const events = await GoogleCalendarService.getUpcomingEvents(
      userId,
      days ? parseInt(days as string) : 7
    );

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
      },
    });
  } catch (error: any) {
    console.error('❌ Get upcoming events failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch upcoming events',
    });
  }
});

/**
 * @route   GET /api/google-calendar/today
 * @desc    Get today's events
 * @access  Private
 */
router.get('/today', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const events = await GoogleCalendarService.getTodayEvents(userId);

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
      },
    });
  } catch (error: any) {
    console.error('❌ Get today events failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch today\'s events',
    });
  }
});

/**
 * @route   GET /api/google-calendar/search
 * @desc    Search calendar events
 * @access  Private
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }

    const events = await GoogleCalendarService.searchEvents(userId, q as string);

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
        query: q,
      },
    });
  } catch (error: any) {
    console.error('❌ Search calendar events failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search calendar events',
    });
  }
});

export default router;
