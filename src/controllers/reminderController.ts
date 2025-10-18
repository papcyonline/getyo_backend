import { Request, Response } from 'express';
import Reminder from '../models/Reminder';
import { AuthRequest } from '../types';
import { openaiService } from '../services/openaiService';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const reminderController = {
  // Get all reminders for a user
  async getReminders(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
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
      const userId = req.userId;

      // Filter out undefined values to avoid MongoDB errors
      const cleanedData: any = {};
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          cleanedData[key] = req.body[key];
        }
      });

      const reminderData = {
        ...cleanedData,
        userId,
      };

      console.log('💾 Creating reminder with data:', JSON.stringify(reminderData, null, 2));

      const reminder = new Reminder(reminderData);
      await reminder.save();

      console.log('✅ Reminder saved successfully:', reminder._id);

      res.status(201).json({
        success: true,
        data: reminder,
        message: 'Reminder created successfully',
      });
    } catch (error: any) {
      console.error('❌ Error creating reminder:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        errors: error.errors,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create reminder',
        details: error.message
      });
    }
  },

  // Update a reminder
  async updateReminder(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;

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

  // Extract reminder details from voice transcript using AI
  async extractReminderFromVoice(req: AuthRequest, res: Response) {
    try {
      const { transcript, recordedAt } = req.body;

      if (!transcript) {
        return res.status(400).json({
          success: false,
          error: 'Transcript is required',
        });
      }

      console.log('🤖 Extracting reminder data from transcript using AI...');
      console.log('📝 Transcript:', transcript);

      const referenceTime = recordedAt ? new Date(recordedAt) : new Date();

      // Use OpenAI to extract structured reminder data
      const prompt = `Extract reminder information from the following voice transcript.
Current date and time: ${referenceTime.toISOString()}

Transcript: "${transcript}"

Extract and return a JSON object with the following fields:
- title: Brief reminder title (required)
- notes: Additional details or context (optional)
- reminderTime: ISO 8601 datetime when reminder should trigger (required, parse relative times like "tomorrow at 3pm", "in 2 hours", "next Monday", etc.)
- isUrgent: boolean indicating urgency (default: false)
- repeatType: "none", "daily", "weekly", or "monthly" (default: "none")
- location: location name if mentioned (optional)

Important date/time parsing rules:
- "tomorrow" = next day at parsed time or 9 AM if no time specified
- "next week" = 7 days from now at 9 AM
- "in X hours/days" = current time + X hours/days
- "Monday/Tuesday/etc" = next occurrence of that weekday at 9 AM
- Parse both 12-hour (3pm, 10am) and 24-hour (15:00) formats
- If only time mentioned, assume today if time hasn't passed, tomorrow if it has

Return ONLY valid JSON, no markdown formatting or explanation.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an AI assistant that extracts structured reminder data from natural language. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const extractedText = completion.choices[0]?.message?.content?.trim();

      if (!extractedText) {
        throw new Error('No response from AI');
      }

      // Parse the JSON response
      let extractedData;
      try {
        // Remove markdown code blocks if present
        const cleanedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', extractedText);
        throw new Error('Failed to parse AI response as JSON');
      }

      // Validate required fields
      if (!extractedData.title) {
        extractedData.title = transcript.substring(0, 50) + '...';
      }

      if (!extractedData.reminderTime) {
        // Default to 1 hour from now if no time extracted
        const defaultTime = new Date(referenceTime);
        defaultTime.setHours(defaultTime.getHours() + 1);
        extractedData.reminderTime = defaultTime.toISOString();
      }

      // Ensure reminderTime is a valid ISO string
      extractedData.reminderTime = new Date(extractedData.reminderTime).toISOString();

      // Set defaults
      extractedData.isUrgent = extractedData.isUrgent || false;
      extractedData.repeatType = extractedData.repeatType || 'none';

      console.log('✅ Extracted reminder data:', extractedData);

      res.json({
        success: true,
        data: extractedData,
      });
    } catch (error) {
      console.error('Error extracting reminder from voice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to extract reminder data',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};