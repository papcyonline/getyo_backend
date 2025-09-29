import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import { AuthRequest } from '../types';
import { openaiService, ChatMessage } from '../services/openaiService';
import { User } from '../models';

export const conversationController = {
  // Get all conversations for a user
  async getConversations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { limit = 20, offset = 0 } = req.query;

      const conversations = await Conversation.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(offset as string));

      res.json({
        success: true,
        data: conversations,
        count: conversations.length,
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversations',
      });
    }
  },

  // Get a single conversation
  async getConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const conversation = await Conversation.findOne({ _id: id, userId });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversation',
      });
    }
  },

  // Create a new conversation
  async createConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { title, initialMessage } = req.body;

      const conversation = new Conversation({
        userId,
        title: title || 'New Conversation',
        messages: initialMessage ? [{
          id: Date.now().toString(),
          role: 'user',
          content: initialMessage,
          timestamp: new Date().toISOString(),
        }] : [],
        context: {},
      });

      await conversation.save();

      res.status(201).json({
        success: true,
        data: conversation,
        message: 'Conversation created successfully',
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create conversation',
      });
    }
  },

  // Add a message to a conversation
  async addMessage(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { role, content, audioUrl, metadata } = req.body;

      const conversation = await Conversation.findOne({ _id: id, userId });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      // Add message using the model method
      await conversation.addMessage(role, content, audioUrl, metadata);

      const newMessage = conversation.messages[conversation.messages.length - 1];

      res.json({
        success: true,
        data: newMessage,
        message: 'Message added successfully',
      });
    } catch (error) {
      console.error('Error adding message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add message',
      });
    }
  },

  // Update conversation context
  async updateContext(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { context } = req.body;

      const conversation = await Conversation.findOneAndUpdate(
        { _id: id, userId },
        {
          context,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation,
        message: 'Context updated successfully',
      });
    } catch (error) {
      console.error('Error updating context:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update context',
      });
    }
  },

  // Delete a conversation
  async deleteConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const conversation = await Conversation.findOneAndDelete({ _id: id, userId });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        message: 'Conversation deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete conversation',
      });
    }
  },

  // Get conversation summary
  async getConversationSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const conversation = await Conversation.findOne({ _id: id, userId });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const summary = {
        id: conversation._id,
        title: conversation.title,
        messageCount: conversation.messages.length,
        firstMessage: conversation.messages[0],
        lastMessage: conversation.messages[conversation.messages.length - 1],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error fetching conversation summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversation summary',
      });
    }
  },

  // Clear conversation messages
  async clearMessages(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const conversation = await Conversation.findOneAndUpdate(
        { _id: id, userId },
        {
          messages: [],
          context: {},
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation,
        message: 'Messages cleared successfully',
      });
    } catch (error) {
      console.error('Error clearing messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear messages',
      });
    }
  },

  // Send message and get AI response
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { message, conversationId } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message is required',
        });
      }

      // Get user info for assistant name
      const user = await User.findById(userId);
      const assistantName = user?.assistantName || 'Yo!';

      // Find or create conversation
      let conversation = null;
      if (conversationId) {
        conversation = await Conversation.findOne({ _id: conversationId, userId });
      }

      if (!conversation) {
        // Create new conversation
        conversation = new Conversation({
          userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          messages: [],
        });
      }

      // Add user message
      await conversation.addMessage('user', message.trim());

      // Prepare messages for OpenAI (convert format)
      const chatMessages: ChatMessage[] = conversation.messages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Get AI response
      const aiResponse = await openaiService.generateChatCompletion(
        chatMessages,
        userId,
        assistantName
      );

      if (!aiResponse.success) {
        return res.status(500).json({
          success: false,
          error: aiResponse.error || 'Failed to generate AI response',
        });
      }

      // Add AI response to conversation
      await conversation.addMessage('assistant', aiResponse.message!);

      // Save conversation
      await conversation.save();

      // Return the latest messages
      const latestMessages = conversation.messages.slice(-2); // User message + AI response

      res.json({
        success: true,
        data: {
          conversationId: conversation._id,
          messages: latestMessages,
          aiResponse: aiResponse.message,
        },
        message: 'Message sent and response received',
      });

    } catch (error) {
      console.error('Error in sendMessage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message and generate response',
      });
    }
  },

  // Transcribe audio and get AI response
  async transcribeAndRespond(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { conversationId } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({
          success: false,
          error: 'Audio file is required',
        });
      }

      // Transcribe audio using Whisper
      const transcription = await openaiService.transcribeAudio(audioFile.path);

      if (!transcription.success) {
        return res.status(500).json({
          success: false,
          error: transcription.error || 'Failed to transcribe audio',
        });
      }

      const transcribedText = transcription.transcript!;

      // Get user info for assistant name
      const user = await User.findById(userId);
      const assistantName = user?.assistantName || 'Yo!';

      // Find or create conversation
      let conversation = null;
      if (conversationId) {
        conversation = await Conversation.findOne({ _id: conversationId, userId });
      }

      if (!conversation) {
        // Create new conversation
        conversation = new Conversation({
          userId,
          title: transcribedText.substring(0, 50) + (transcribedText.length > 50 ? '...' : ''),
          messages: [],
        });
      }

      // Add user message (transcription)
      await conversation.addMessage('user', transcribedText);

      // Prepare messages for OpenAI (convert format)
      const chatMessages: ChatMessage[] = conversation.messages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Get AI response
      const aiResponse = await openaiService.generateChatCompletion(
        chatMessages,
        userId,
        assistantName
      );

      if (!aiResponse.success) {
        return res.status(500).json({
          success: false,
          error: aiResponse.error || 'Failed to generate AI response',
        });
      }

      // Add AI response to conversation
      await conversation.addMessage('assistant', aiResponse.message!);

      // Save conversation
      await conversation.save();

      // Return both transcription and AI response
      res.json({
        success: true,
        data: {
          conversationId: conversation._id,
          transcript: transcribedText,
          aiResponse: aiResponse.message,
          messages: conversation.messages.slice(-2), // User message + AI response
        },
        message: 'Audio transcribed and response generated',
      });

    } catch (error) {
      console.error('Error in transcribeAndRespond:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process audio and generate response',
      });
    }
  },

  // Save voice conversation session with extracted data
  async saveVoiceSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { transcript, extractedData } = req.body;

      if (!transcript || !Array.isArray(transcript)) {
        return res.status(400).json({
          success: false,
          error: 'Transcript array is required',
        });
      }

      // Create conversation title from first user message
      const firstUserMessage = transcript.find((msg: any) => msg.role === 'user');
      const title = firstUserMessage
        ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
        : 'Voice Conversation';

      // Create new conversation
      const conversation = new Conversation({
        userId,
        title,
        messages: transcript.map((msg: any) => ({
          id: Date.now().toString() + Math.random(),
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || new Date().toISOString(),
        })),
        context: {
          type: 'voice_session',
          extractedData: extractedData || {},
        },
      });

      await conversation.save();

      res.status(201).json({
        success: true,
        data: {
          conversationId: conversation._id,
          extractedData: extractedData || {},
        },
        message: 'Voice session saved successfully',
      });

    } catch (error) {
      console.error('Error saving voice session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save voice session',
      });
    }
  },

  // Extract tasks, events, and reminders from conversation text
  async extractTasksFromConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { conversationText } = req.body;

      if (!conversationText) {
        return res.status(400).json({
          success: false,
          error: 'Conversation text is required',
        });
      }

      // Get user info for assistant name
      const user = await User.findById(userId);
      const assistantName = user?.assistantName || 'Yo!';

      // Use OpenAI to extract structured data from conversation
      const extractionPrompt = `You are an AI assistant analyzing a conversation between a user and their personal assistant "${assistantName}". Extract all tasks, events, and reminders mentioned in the conversation.

Conversation:
${conversationText}

Extract and return ONLY a valid JSON object with this exact structure:
{
  "tasks": [
    {
      "title": "string",
      "description": "string (optional)",
      "priority": "low" | "medium" | "high",
      "dueDate": "ISO date string (optional)"
    }
  ],
  "events": [
    {
      "title": "string",
      "startTime": "ISO date string",
      "endTime": "ISO date string (optional)",
      "attendees": ["string array (optional)"]
    }
  ],
  "reminders": [
    {
      "message": "string",
      "time": "ISO date string"
    }
  ]
}

Rules:
- Extract specific actionable items only
- Infer priority from context (urgent words = high, casual = low, default = medium)
- Parse dates/times naturally (e.g., "tomorrow at 3pm", "next Monday")
- If no specific time, use reasonable defaults (e.g., tomorrow 9am for tasks)
- Return empty arrays if no items of that type found`;

      const messages: ChatMessage[] = [
        { role: 'user', content: extractionPrompt }
      ];

      const aiResponse = await openaiService.generateChatCompletion(
        messages,
        userId,
        assistantName
      );

      if (!aiResponse.success || !aiResponse.message) {
        // Return empty structure if AI fails
        return res.json({
          success: true,
          data: {
            tasks: [],
            events: [],
            reminders: [],
          },
          message: 'Using fallback extraction',
        });
      }

      // Parse AI response as JSON
      try {
        const extractedData = JSON.parse(aiResponse.message);

        res.json({
          success: true,
          data: extractedData,
          message: 'Tasks extracted successfully',
        });
      } catch (parseError) {
        console.error('Failed to parse AI extraction response:', parseError);
        // Return empty structure if parsing fails
        res.json({
          success: true,
          data: {
            tasks: [],
            events: [],
            reminders: [],
          },
          message: 'Extraction parsing failed',
        });
      }

    } catch (error) {
      console.error('Error extracting tasks from conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to extract tasks from conversation',
      });
    }
  },
};