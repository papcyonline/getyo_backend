import { Request, Response } from 'express';
import OpenAI from 'openai';
import { AuthRequest } from '../types';
import Conversation from '../models/Conversation';
import Task from '../models/Task';
import Event from '../models/Event';
import Reminder from '../models/Reminder';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const aiController = {
  // Process a chat message with AI
  async chat(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { message, conversationId, context } = req.body;

      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await Conversation.findOne({ _id: conversationId, userId });
      }

      if (!conversation) {
        conversation = new Conversation({
          userId,
          title: message.substring(0, 50),
          messages: [],
          context: context || {},
        });
      }

      // Add user message to conversation using the model method
      await conversation.addMessage('user', message);

      // Prepare messages for OpenAI
      const messages = [
        {
          role: 'system' as const,
          content: `You are Yo!, a highly capable AI personal assistant. You help users manage their tasks, schedule, reminders, and daily activities. Be friendly, concise, and proactive in offering assistance.

Current context:
- User ID: ${userId}
- Date: ${new Date().toLocaleDateString()}
- Time: ${new Date().toLocaleTimeString()}
${context ? `Additional context: ${JSON.stringify(context)}` : ''}`
        },
        ...conversation.messages.slice(-10).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ];

      // Get AI response
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const aiResponse = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.';

      // Add AI response to conversation using the model method
      await conversation.addMessage('assistant', aiResponse);

      await conversation.save();

      res.json({
        success: true,
        data: {
          message: aiResponse,
          conversationId: conversation._id,
        },
      });
    } catch (error) {
      console.error('Error in AI chat:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process chat message',
      });
    }
  },

  // Process a command (create task, set reminder, etc.)
  async processCommand(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { command, context } = req.body;

      // Use OpenAI to understand the command intent
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that processes natural language commands and returns structured JSON responses. Analyze the command and determine the action type and parameters.

Return a JSON object with:
- action: one of ['create_task', 'create_event', 'create_reminder', 'query', 'unknown']
- parameters: object with relevant fields based on action
- response: a friendly message to the user

Example: "Remind me to call mom tomorrow at 3pm"
Returns: {
  "action": "create_reminder",
  "parameters": {
    "title": "Call mom",
    "reminderTime": "tomorrow at 3pm"
  },
  "response": "I'll remind you to call mom tomorrow at 3pm."
}`
          },
          {
            role: 'user',
            content: command
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

      // Process the action based on the intent
      let actionResult = null;

      switch (result.action) {
        case 'create_task':
          const task = new Task({
            userId,
            title: result.parameters.title,
            description: result.parameters.description,
            priority: result.parameters.priority || 'medium',
            dueDate: result.parameters.dueDate,
            createdBy: 'ai_suggestion',
          });
          await task.save();
          actionResult = { type: 'task', data: task };
          break;

        case 'create_event':
          const event = new Event({
            userId,
            title: result.parameters.title,
            description: result.parameters.description,
            startTime: result.parameters.startTime,
            endTime: result.parameters.endTime,
            location: result.parameters.location,
          });
          await event.save();
          actionResult = { type: 'event', data: event };
          break;

        case 'create_reminder':
          const reminder = new Reminder({
            userId,
            title: result.parameters.title,
            reminderTime: result.parameters.reminderTime,
            notes: result.parameters.notes,
          });
          await reminder.save();
          actionResult = { type: 'reminder', data: reminder };
          break;

        case 'query':
          // Handle queries about existing data
          actionResult = { type: 'query', message: result.response };
          break;

        default:
          actionResult = { type: 'unknown', message: result.response };
      }

      res.json({
        success: true,
        data: {
          action: result.action,
          result: actionResult,
          message: result.response,
        },
      });
    } catch (error) {
      console.error('Error processing command:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process command',
      });
    }
  },

  // Generate suggestions based on user data
  async getSuggestions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      // Get user's recent tasks, events, and reminders
      const [tasks, events, reminders] = await Promise.all([
        Task.find({ userId, status: { $ne: 'completed' } }).limit(5),
        Event.find({ userId, startTime: { $gte: new Date() } }).limit(5),
        Reminder.find({ userId, status: 'active' }).limit(5),
      ]);

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Based on the user's current tasks, events, and reminders, provide 3-5 helpful suggestions or insights. Be concise and actionable.

User's data:
Tasks: ${JSON.stringify(tasks.map(t => ({ title: t.title, priority: t.priority, dueDate: t.dueDate })))}
Events: ${JSON.stringify(events.map(e => ({ title: e.title, startTime: e.startTime })))}
Reminders: ${JSON.stringify(reminders.map(r => ({ title: r.title, reminderTime: r.reminderTime })))}`
          },
          {
            role: 'user',
            content: 'What suggestions do you have for me?'
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const suggestions = completion.choices[0]?.message?.content || '';

      res.json({
        success: true,
        data: {
          suggestions: suggestions.split('\n').filter(s => s.trim()),
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error generating suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate suggestions',
      });
    }
  },

  // Generate a daily briefing
  async getDailyBriefing(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      // Get today's data
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [tasks, events, reminders] = await Promise.all([
        Task.find({
          userId,
          $or: [
            { dueDate: { $gte: todayStart, $lte: todayEnd } },
            { status: 'in_progress' }
          ]
        }),
        Event.find({
          userId,
          startTime: { $gte: todayStart, $lte: todayEnd }
        }),
        Reminder.find({
          userId,
          reminderTime: { $gte: todayStart, $lte: todayEnd },
          status: 'active'
        }),
      ]);

      const briefingData = {
        date: new Date().toLocaleDateString(),
        tasksCount: tasks.length,
        eventsCount: events.length,
        remindersCount: reminders.length,
        highPriorityTasks: tasks.filter(t => t.priority === 'high').length,
        firstEvent: events[0],
        tasks: tasks.map(t => ({ title: t.title, priority: t.priority, status: t.status })),
        events: events.map(e => ({ title: e.title, startTime: e.startTime, location: e.location })),
        reminders: reminders.map(r => ({ title: r.title, reminderTime: r.reminderTime })),
      };

      res.json({
        success: true,
        data: briefingData,
      });
    } catch (error) {
      console.error('Error generating daily briefing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate daily briefing',
      });
    }
  },
};