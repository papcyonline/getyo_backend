import { Request, Response } from 'express';
import Event from '../models/Event';
import { AuthRequest } from '../types';

export const eventController = {
  // Get all events for a user
  async getEvents(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { startDate, endDate, source } = req.query;

      let query: any = { userId };

      // Apply date filters
      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = new Date(startDate as string);
        if (endDate) query.startTime.$lte = new Date(endDate as string);
      }

      if (source) query.source = source;

      const events = await Event.find(query).sort({ startTime: 1 });

      res.json({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch events',
      });
    }
  },

  // Get a single event
  async getEvent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const event = await Event.findOne({ _id: id, userId });

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
        });
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch event',
      });
    }
  },

  // Create a new event
  async createEvent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const eventData = {
        ...req.body,
        userId,
      };

      const event = new Event(eventData);
      await event.save();

      res.status(201).json({
        success: true,
        data: event,
        message: 'Event created successfully',
      });
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create event',
      });
    }
  },

  // Update an event
  async updateEvent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const updates = req.body;

      // Prevent updating userId
      delete updates.userId;

      const event = await Event.findOneAndUpdate(
        { _id: id, userId },
        updates,
        { new: true, runValidators: true }
      );

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
        });
      }

      res.json({
        success: true,
        data: event,
        message: 'Event updated successfully',
      });
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update event',
      });
    }
  },

  // Delete an event
  async deleteEvent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const event = await Event.findOneAndDelete({ _id: id, userId });

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
        });
      }

      res.json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete event',
      });
    }
  },

  // Get today's events
  async getTodayEvents(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const events = await Event.find({
        userId,
        startTime: { $gte: todayStart, $lte: todayEnd }
      }).sort({ startTime: 1 });

      res.json({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (error) {
      console.error('Error fetching today\'s events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch today\'s events',
      });
    }
  },

  // Get upcoming events
  async getUpcomingEvents(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const limit = parseInt(req.query.limit as string) || 10;

      const events = await Event.find({
        userId,
        startTime: { $gte: new Date() }
      })
      .sort({ startTime: 1 })
      .limit(limit);

      res.json({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upcoming events',
      });
    }
  },
};