import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import { AuthRequest } from '../types';
import { openaiService, ChatMessage } from '../services/openaiService';
import { User } from '../models';
import ConversationMemoryService from '../services/ConversationMemoryService';
import assignmentProcessingJob from '../jobs/assignmentProcessingJob';
import { TaskStatus, AssignmentStatus } from '../constants/statuses';

export const conversationController = {
  // Get all conversations for a user
  async getConversations(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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

  // Send message and get AI response WITH intelligent action execution
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { message, conversationId, mode = 'text' } = req.body; // mode: 'text' | 'voice'

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!message?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message is required',
        });
      }

      const isVoiceMode = mode === 'voice';
      console.log(`💬 Processing message in ${mode} mode`);

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

      // ==========================================
      // INTELLIGENT ACTION DETECTION & EXECUTION
      // ==========================================
      const Task = (await import('../models/Task')).default;
      const Reminder = (await import('../models/Reminder')).default;
      const Note = (await import('../models/Note')).default;

      // Detect intent and extract structured data using INTELLIGENT AI classification
      const { getIntelligentIntentPrompt } = await import('../prompts/intelligentIntentPrompt');
      const intentResponse = await openaiService.generateChatCompletion(
        [{
          role: 'user',
          content: getIntelligentIntentPrompt(message.trim(), new Date().toISOString())
        }],
        userId as string,
        assistantName
      );

      let actionsExecuted: any[] = [];
      let intentData = null;

      // Parse AI response for actions
      try {
        if (intentResponse.success && intentResponse.message) {
          // Remove markdown code blocks if present
          let cleanedResponse = intentResponse.message.trim();
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
          }

          intentData = JSON.parse(cleanedResponse);

          // Check if clarification is needed
          if (intentData.needsClarification) {
            console.log(`❓ Clarification needed: ${intentData.clarificationNeeded}`);

            // Don't create any actions, just ask for clarification
            // The PA will ask the user through the conversational response
            // intentData.hasActions should be false when needsClarification is true
          }

          // Check if permission is needed
          if (intentData.needsPermission) {
            console.log(`🔐 Permission needed: ${intentData.permissionsNeeded?.join(', ')}`);
            console.log(`📝 Reason: ${intentData.permissionReason}`);

            // Don't create any actions, just prompt for permission
            // The PA will ask the user to grant permission through the conversational response
            // intentData.hasActions should be false when needsPermission is true
          }

          if (intentData.hasActions) {
            console.log(`🤖 Detected actions:`, intentData);

            // Create Tasks (User actions)
            if (intentData.tasks && intentData.tasks.length > 0) {
              for (const taskData of intentData.tasks) {
                const task = new Task({
                  userId,
                  title: taskData.title,
                  description: taskData.description || '',
                  priority: taskData.priority || 'medium',
                  dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
                  status: TaskStatus.PENDING,
                  createdBy: 'ai', // Valid enum: 'user', 'ai', 'voice'
                });
                await task.save();
                actionsExecuted.push({ type: 'task', data: task });
                console.log(`✅ Task created: ${task.title}`);
              }
            }

            // Create Assignments (PA actions - research, find, compare, etc.)
            if (intentData.assignments && intentData.assignments.length > 0) {
              const Assignment = (await import('../models/Assignment')).default;
              const Notification = (await import('../models/Notification')).default;

              for (const assignmentData of intentData.assignments) {
                try {
                  // Create the assignment
                  const assignment = new Assignment({
                    userId,
                    title: assignmentData.title,
                    description: assignmentData.description || '',
                    query: assignmentData.query,
                    type: assignmentData.type || 'research',
                    priority: assignmentData.priority || 'medium',
                    status: AssignmentStatus.IN_PROGRESS,
                  });
                  await assignment.save();
                  console.log(`🎯 Assignment created: ${assignment.title}`);

                  // Queue assignment for background processing
                  // User can close app, PA will notify when done
                  await assignmentProcessingJob.queue(String(assignment._id));
                  console.log(`⏰ Assignment queued for background processing: ${String(assignment._id)}`)

                  actionsExecuted.push({ type: 'assignment', data: assignment });
                } catch (assignmentError) {
                  console.error('Failed to create assignment:', assignmentError);
                }
              }
            }

            // Create Reminders
            if (intentData.reminders && intentData.reminders.length > 0) {
              for (const reminderData of intentData.reminders) {
                const reminder = new Reminder({
                  userId,
                  title: reminderData.title,
                  notes: reminderData.notes || '',
                  reminderTime: new Date(reminderData.reminderTime),
                  isUrgent: reminderData.isUrgent || false,
                  status: 'active',
                  // No createdBy field in Reminder model
                });
                await reminder.save();
                actionsExecuted.push({ type: 'reminder', data: reminder });
                console.log(`✅ Reminder created: ${reminder.title}`);
              }
            }

            // Create Notes
            if (intentData.notes && intentData.notes.length > 0) {
              for (const noteData of intentData.notes) {
                const note = new Note({
                  userId,
                  title: noteData.title,
                  content: noteData.content,
                  category: noteData.category || 'personal',
                  tags: noteData.tags || [],
                  // No createdBy field in Note model
                });
                await note.save();
                actionsExecuted.push({ type: 'note', data: note });
                console.log(`✅ Note created: ${note.title}`);
              }
            }

            // Create Calendar Events
            if (intentData.calendarEvents && intentData.calendarEvents.length > 0) {
              const Event = (await import('../models/Event')).default;
              for (const eventData of intentData.calendarEvents) {
                try {
                  const event = new Event({
                    userId,
                    title: eventData.title,
                    description: eventData.description || '',
                    startTime: new Date(eventData.startTime),
                    endTime: new Date(eventData.endTime),
                    location: eventData.location || '',
                    attendees: eventData.attendees || [],
                    source: 'manual', // Enum: 'manual', 'google_cal', 'apple_cal'
                  });
                  await event.save();
                  actionsExecuted.push({ type: 'calendar_event', data: event });
                  console.log(`✅ Calendar event created: ${event.title}`);
                } catch (eventError) {
                  console.error('Failed to create calendar event:', eventError);
                }
              }
            }

            // Send Emails
            if (intentData.emails && intentData.emails.length > 0) {
              for (const emailData of intentData.emails) {
                try {
                  // Store email draft or send intention
                  const emailDraft = {
                    to: emailData.to,
                    cc: emailData.cc || [],
                    subject: emailData.subject,
                    body: emailData.body,
                    isDraft: true, // Mark as draft for user review
                  };
                  actionsExecuted.push({
                    type: 'email_draft',
                    data: {
                      ...emailDraft,
                      title: `Email to ${emailData.to.join(', ')}: ${emailData.subject}`
                    }
                  });
                  console.log(`✅ Email draft created: ${emailData.subject}`);
                } catch (emailError) {
                  console.error('Failed to create email draft:', emailError);
                }
              }
            }

            // Schedule Meetings
            if (intentData.meetings && intentData.meetings.length > 0) {
              for (const meetingData of intentData.meetings) {
                try {
                  // Store meeting request for user to connect provider
                  const meetingRequest = {
                    provider: meetingData.provider || 'google-meet',
                    title: meetingData.title,
                    startTime: new Date(meetingData.startTime),
                    duration: meetingData.duration || 60,
                    description: meetingData.description || '',
                    attendees: meetingData.attendees || [],
                    status: 'pending_provider', // Requires provider connection
                  };
                  actionsExecuted.push({
                    type: 'meeting_request',
                    data: {
                      ...meetingRequest,
                      title: `${meetingData.provider} meeting: ${meetingData.title}`
                    }
                  });
                  console.log(`✅ Meeting request created: ${meetingData.title}`);
                } catch (meetingError) {
                  console.error('Failed to create meeting request:', meetingError);
                }
              }
            }

            // Handle Search Requests
            if (intentData.search && intentData.search.query) {
              try {
                actionsExecuted.push({
                  type: 'search',
                  data: {
                    query: intentData.search.query,
                    searchType: intentData.search.type || 'web',
                    title: `Search: ${intentData.search.query}`
                  }
                });
                console.log(`✅ Search initiated: ${intentData.search.query}`);
              } catch (searchError) {
                console.error('Failed to initiate search:', searchError);
              }
            }
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Could not parse intent data, continuing without actions:', parseError);
      }

      // GET COMPREHENSIVE PA CONTEXT + QUICK ACTIONS DATA + INTEGRATION DATA
      const paContextService = (await import('../services/paContextService')).default;
      const quickActionsService = (await import('../services/quickActionsAggregatorService')).default;
      const integrationService = (await import('../services/integrationAggregatorService')).default;

      const [contextSummary, quickActionsSummary, integrationSummary] = await Promise.all([
        paContextService.getContextSummary(userId as string),
        quickActionsService.generateQuickActionsSummary(userId as string),
        integrationService.generateIntegrationSummary(userId as string)
      ]);

      // Prepare messages for OpenAI response (convert format)
      const chatMessages: ChatMessage[] = conversation.messages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Add PA context at the beginning (so AI knows everything about the user)
      chatMessages.unshift({
        role: 'system',
        content: `You are ${assistantName}, an intelligent personal assistant with complete access to the user's data and app.

${isVoiceMode ? `
🎤 VOICE MODE ACTIVATED 🎤
The user is speaking to you via voice. Your response will be read aloud to them.
IMPORTANT VOICE RESPONSE RULES:
- Keep responses SHORT and CONVERSATIONAL (1-3 sentences max)
- Use natural spoken language, not written text
- NO markdown, NO links, NO formatting
- NO lists or bullet points (unless absolutely necessary, then use "first, second, third")
- Be CONCISE and TO THE POINT
- Examples:
  ✅ "Got it! I've added that task for tomorrow."
  ✅ "You have 3 tasks due today and 2 meetings this afternoon."
  ❌ "I've successfully created a task for you. Here are the details: [long explanation]"
  ❌ "Check out this link: https://..."
` : `
💬 TEXT CHAT MODE 💬
The user is typing to you. You can provide detailed, formatted responses.
TEXT RESPONSE STYLE:
- Can be detailed and comprehensive
- Use markdown formatting (bold, lists, links)
- Include relevant details and context
- Provide actionable information
- Can include multiple paragraphs if helpful
`}

Here is the current context:

${contextSummary}

${intentData?.needsClarification ? `
⚠️⚠️⚠️ IMPORTANT - CLARIFICATION NEEDED ⚠️⚠️⚠️
The user's request is missing critical information. You MUST ask them:
"${intentData.clarificationNeeded}"

DO NOT create any actions until you get this information.
Ask the question naturally and wait for their response.
Example: "Sure! ${intentData.clarificationNeeded}"
` : ''}

${intentData?.needsPermission ? `
🔐🔐🔐 IMPORTANT - PERMISSION REQUIRED 🔐🔐🔐
The user's request requires device permissions that haven't been granted yet.

Permissions needed: ${intentData.permissionsNeeded?.join(', ')}
Reason: ${intentData.permissionReason}

You MUST respond by:
1. Explaining what you want to do for them
2. Explaining why you need the permission
3. Asking them to grant the permission in settings

Example response:
"I'd love to help you with that! To ${intentData.permissionReason}, I need access to your ${intentData.permissionsNeeded?.join(' and ')}.

Could you please grant me ${intentData.permissionsNeeded?.join(' and ')} permission? Just go to your device Settings → Yo! → Permissions and enable ${intentData.permissionsNeeded?.join(' and ')}. Once you do that, I'll be able to help you right away!"

BE HELPFUL and ENCOURAGING. Make it easy for them to understand what to do.
` : ''}

═══════════════════════════════════════════════════════════
📱 QUICK ACTIONS DASHBOARD - COMPREHENSIVE USER DATA
═══════════════════════════════════════════════════════════

${quickActionsSummary}

${integrationSummary}

CAPABILITIES:
You can:
1. CREATE: Tasks, Reminders, Notes, Calendar Events, Email Drafts, Meetings
2. QUERY: Answer questions about user's data, integrations, schedule, productivity
3. ANALYZE: Provide insights, summaries, analytics
4. MANAGE: Guide users on connecting integrations, updating settings
5. SEARCH: Find emails, tasks, calendar events, notes

IMPORTANT QUERY HANDLING:
When the user asks about:
- "What's happening today/tomorrow?" → Reference upcomingActivities.today or upcomingActivities.tomorrow
- "Any tasks due soon?" → Reference tasks.dueToday, tasks.dueTomorrow, tasks.dueThisWeek
- "What's on my schedule?" → Reference calendarEvents.today, calendarEvents.tomorrow
- "Any reminders?" → Reference reminders.dueToday, reminders.dueTomorrow
- "Latest updates?" → Reference latestUpdates (notifications, completedAssignments, completedTasks)
- "What did I accomplish?" → Reference completedTasks, completedAssignments
- "Show me my notes" → Reference notes.recent, notes.todayNotes
- "What integrations are connected?" → Reference integration summary (Google, Microsoft, Social Media, etc.)
- "Can you access my [service]?" → Check integration status and permissions
- "Read my location/contacts/photos" → Check device permissions first
- "Send email/message" → Verify email/communication integrations are connected

CONTEXT AWARENESS:
- Know what integrations are connected and suggest connecting missing ones
- Reference user's current data when answering questions (use specific numbers and details from Quick Actions data)
- Provide personalized responses based on user's profile and activity
- Be proactive in suggesting optimizations and improvements

RESPONSE STYLE:
- Friendly and conversational using the user's name (${user?.preferredName || user?.fullName || 'there'})
- Concise but informative
- Proactive in offering help
- Reference specific data when relevant (e.g., "You have 5 tasks due today, 3 reminders set, and 2 calendar events")
- When listing activities, organize by time (today first, then tomorrow, then this week)

Always maintain context from previous messages in the conversation.`
      });

      // Add context about actions taken
      if (actionsExecuted.length > 0) {
        chatMessages.push({
          role: 'system',
          content: `You just successfully executed these actions: ${actionsExecuted.map(a => `${a.type}: ${a.data.title}`).join(', ')}. Confirm this to the user in a friendly way.`
        });
      }

      // Get AI response
      const aiResponse = await openaiService.generateChatCompletion(
        chatMessages,
        userId as string,
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

      // Generate TTS audio for AI response using user's selected voice
      let audioBuffer = null;
      if (user?.assistantVoice && aiResponse.message) {
        console.log(`🔊 Generating TTS with voice: ${user.assistantVoice}`);
        try {
          audioBuffer = await openaiService.generateSpeech(aiResponse.message, user.assistantVoice);
          console.log(`✅ TTS audio generated successfully`);
        } catch (ttsError) {
          console.error('❌ TTS generation failed:', ttsError);
          // Continue without audio if TTS fails
        }
      }

      // Return the latest messages
      const latestMessages = conversation.messages.slice(-2); // User message + AI response

      res.json({
        success: true,
        data: {
          conversationId: conversation._id,
          messages: latestMessages,
          aiResponse: aiResponse.message,
          audioBuffer: audioBuffer ? audioBuffer.toString('base64') : null, // Send as base64
          voice: user?.assistantVoice || 'alloy',
          actionsExecuted: actionsExecuted.map(a => ({
            type: a.type,
            id: a.data._id,
            title: a.data.title
          })), // Return info about created items
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
      const userId = req.userId;
      const { conversationId } = req.body;
      const audioFile = req.file;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

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

      // ==========================================
      // INTELLIGENT ACTION DETECTION & EXECUTION (Same as sendMessage)
      // ==========================================
      const Task = (await import('../models/Task')).default;
      const Reminder = (await import('../models/Reminder')).default;
      const Note = (await import('../models/Note')).default;

      // Detect intent and extract structured data using INTELLIGENT AI classification
      const { getIntelligentIntentPrompt } = await import('../prompts/intelligentIntentPrompt');
      const intentResponse = await openaiService.generateChatCompletion(
        [{
          role: 'user',
          content: getIntelligentIntentPrompt(transcribedText, new Date().toISOString())
        }],
        userId as string,
        assistantName
      );

      let actionsExecuted: any[] = [];
      let intentData = null;

      // Parse AI response for actions
      try {
        if (intentResponse.success && intentResponse.message) {
          // Remove markdown code blocks if present
          let cleanedResponse = intentResponse.message.trim();
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
          }

          intentData = JSON.parse(cleanedResponse);

          // Check if clarification is needed
          if (intentData.needsClarification) {
            console.log(`❓ Clarification needed: ${intentData.clarificationNeeded}`);

            // Don't create any actions, just ask for clarification
            // The PA will ask the user through the conversational response
            // intentData.hasActions should be false when needsClarification is true
          }

          // Check if permission is needed
          if (intentData.needsPermission) {
            console.log(`🔐 Permission needed: ${intentData.permissionsNeeded?.join(', ')}`);
            console.log(`📝 Reason: ${intentData.permissionReason}`);

            // Don't create any actions, just prompt for permission
            // The PA will ask the user to grant permission through the conversational response
            // intentData.hasActions should be false when needsPermission is true
          }

          if (intentData.hasActions) {
            console.log(`🤖 Detected actions from voice:`, intentData);

            // Create Tasks (User actions)
            if (intentData.tasks && intentData.tasks.length > 0) {
              for (const taskData of intentData.tasks) {
                const task = new Task({
                  userId,
                  title: taskData.title,
                  description: taskData.description || '',
                  priority: taskData.priority || 'medium',
                  dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
                  status: TaskStatus.PENDING,
                  createdBy: 'voice', // Valid enum: 'user', 'ai', 'voice'
                });
                await task.save();
                actionsExecuted.push({ type: 'task', data: task });
                console.log(`✅ Task created from voice: ${task.title}`);
              }
            }

            // Create Assignments (PA actions via voice - research, find, compare, etc.)
            if (intentData.assignments && intentData.assignments.length > 0) {
              const Assignment = (await import('../models/Assignment')).default;
              const Notification = (await import('../models/Notification')).default;

              for (const assignmentData of intentData.assignments) {
                try {
                  const assignment = new Assignment({
                    userId,
                    title: assignmentData.title,
                    description: assignmentData.description || '',
                    query: assignmentData.query,
                    type: assignmentData.type || 'research',
                    priority: assignmentData.priority || 'medium',
                    status: AssignmentStatus.IN_PROGRESS,
                  });
                  await assignment.save();
                  console.log(`🎯 Assignment created from voice: ${assignment.title}`);

                  // Queue assignment for background processing
                  // User can close app, PA will notify when done
                  await assignmentProcessingJob.queue(String(assignment._id));
                  console.log(`⏰ Voice assignment queued for background processing: ${String(assignment._id)}`)

                  actionsExecuted.push({ type: 'assignment', data: assignment });
                } catch (assignmentError) {
                  console.error('Failed to create assignment from voice:', assignmentError);
                }
              }
            }

            // Create Reminders
            if (intentData.reminders && intentData.reminders.length > 0) {
              for (const reminderData of intentData.reminders) {
                const reminder = new Reminder({
                  userId,
                  title: reminderData.title,
                  notes: reminderData.notes || '',
                  reminderTime: new Date(reminderData.reminderTime),
                  isUrgent: reminderData.isUrgent || false,
                  status: 'active',
                  // No createdBy field in Reminder model
                });
                await reminder.save();
                actionsExecuted.push({ type: 'reminder', data: reminder });
                console.log(`✅ Reminder created from voice: ${reminder.title}`);
              }
            }

            // Create Notes
            if (intentData.notes && intentData.notes.length > 0) {
              for (const noteData of intentData.notes) {
                const note = new Note({
                  userId,
                  title: noteData.title,
                  content: noteData.content,
                  category: noteData.category || 'personal',
                  tags: noteData.tags || [],
                  // No createdBy field in Note model
                });
                await note.save();
                actionsExecuted.push({ type: 'note', data: note });
                console.log(`✅ Note created from voice: ${note.title}`);
              }
            }

            // Create Calendar Events
            if (intentData.calendarEvents && intentData.calendarEvents.length > 0) {
              const Event = (await import('../models/Event')).default;
              for (const eventData of intentData.calendarEvents) {
                try {
                  const event = new Event({
                    userId,
                    title: eventData.title,
                    description: eventData.description || '',
                    startTime: new Date(eventData.startTime),
                    endTime: new Date(eventData.endTime),
                    location: eventData.location || '',
                    attendees: eventData.attendees || [],
                    source: 'manual', // Enum: 'manual', 'google_cal', 'apple_cal'
                  });
                  await event.save();
                  actionsExecuted.push({ type: 'calendar_event', data: event });
                  console.log(`✅ Calendar event created from voice: ${event.title}`);
                } catch (eventError) {
                  console.error('Failed to create calendar event from voice:', eventError);
                }
              }
            }

            // Send Emails
            if (intentData.emails && intentData.emails.length > 0) {
              for (const emailData of intentData.emails) {
                try {
                  const emailDraft = {
                    to: emailData.to,
                    cc: emailData.cc || [],
                    subject: emailData.subject,
                    body: emailData.body,
                    isDraft: true,
                  };
                  actionsExecuted.push({
                    type: 'email_draft',
                    data: {
                      ...emailDraft,
                      title: `Email to ${emailData.to.join(', ')}: ${emailData.subject}`
                    }
                  });
                  console.log(`✅ Email draft created from voice: ${emailData.subject}`);
                } catch (emailError) {
                  console.error('Failed to create email draft from voice:', emailError);
                }
              }
            }

            // Schedule Meetings
            if (intentData.meetings && intentData.meetings.length > 0) {
              for (const meetingData of intentData.meetings) {
                try {
                  const meetingRequest = {
                    provider: meetingData.provider || 'google-meet',
                    title: meetingData.title,
                    startTime: new Date(meetingData.startTime),
                    duration: meetingData.duration || 60,
                    description: meetingData.description || '',
                    attendees: meetingData.attendees || [],
                    status: 'pending_provider',
                  };
                  actionsExecuted.push({
                    type: 'meeting_request',
                    data: {
                      ...meetingRequest,
                      title: `${meetingData.provider} meeting: ${meetingData.title}`
                    }
                  });
                  console.log(`✅ Meeting request created from voice: ${meetingData.title}`);
                } catch (meetingError) {
                  console.error('Failed to create meeting request from voice:', meetingError);
                }
              }
            }

            // Handle Search Requests
            if (intentData.search && intentData.search.query) {
              try {
                actionsExecuted.push({
                  type: 'search',
                  data: {
                    query: intentData.search.query,
                    searchType: intentData.search.type || 'web',
                    title: `Search: ${intentData.search.query}`
                  }
                });
                console.log(`✅ Search initiated from voice: ${intentData.search.query}`);
              } catch (searchError) {
                console.error('Failed to initiate search from voice:', searchError);
              }
            }
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Could not parse intent data from voice, continuing without actions:', parseError);
      }

      // GET COMPREHENSIVE PA CONTEXT + QUICK ACTIONS DATA + INTEGRATION DATA (same as sendMessage)
      const paContextService = (await import('../services/paContextService')).default;
      const quickActionsService = (await import('../services/quickActionsAggregatorService')).default;
      const integrationService = (await import('../services/integrationAggregatorService')).default;

      const [contextSummary, quickActionsSummary, integrationSummary] = await Promise.all([
        paContextService.getContextSummary(userId as string),
        quickActionsService.generateQuickActionsSummary(userId as string),
        integrationService.generateIntegrationSummary(userId as string)
      ]);

      // Prepare messages for OpenAI (convert format)
      const chatMessages: ChatMessage[] = conversation.messages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Add PA context at the beginning (so AI knows everything about the user)
      chatMessages.unshift({
        role: 'system',
        content: `You are ${assistantName}, an intelligent personal assistant with complete access to the user's data and app. Here is the current context:

${contextSummary}

${intentData?.needsClarification ? `
⚠️⚠️⚠️ IMPORTANT - CLARIFICATION NEEDED ⚠️⚠️⚠️
The user's request is missing critical information. You MUST ask them:
"${intentData.clarificationNeeded}"

DO NOT create any actions until you get this information.
Ask the question naturally and wait for their response.
Example: "Sure! ${intentData.clarificationNeeded}"
` : ''}

${intentData?.needsPermission ? `
🔐🔐🔐 IMPORTANT - PERMISSION REQUIRED 🔐🔐🔐
The user's request requires device permissions that haven't been granted yet.

Permissions needed: ${intentData.permissionsNeeded?.join(', ')}
Reason: ${intentData.permissionReason}

You MUST respond by:
1. Explaining what you want to do for them
2. Explaining why you need the permission
3. Asking them to grant the permission in settings

Example response:
"I'd love to help you with that! To ${intentData.permissionReason}, I need access to your ${intentData.permissionsNeeded?.join(' and ')}.

Could you please grant me ${intentData.permissionsNeeded?.join(' and ')} permission? Just go to your device Settings → Yo! → Permissions and enable ${intentData.permissionsNeeded?.join(' and ')}. Once you do that, I'll be able to help you right away!"

BE HELPFUL and ENCOURAGING. Make it easy for them to understand what to do.
` : ''}

═══════════════════════════════════════════════════════════
📱 QUICK ACTIONS DASHBOARD - COMPREHENSIVE USER DATA
═══════════════════════════════════════════════════════════

${quickActionsSummary}

${integrationSummary}

CAPABILITIES:
You can:
1. CREATE: Tasks, Reminders, Notes, Calendar Events, Email Drafts, Meetings
2. QUERY: Answer questions about user's data, integrations, schedule, productivity
3. ANALYZE: Provide insights, summaries, analytics
4. MANAGE: Guide users on connecting integrations, updating settings
5. SEARCH: Find emails, tasks, calendar events, notes

IMPORTANT QUERY HANDLING:
When the user asks about:
- "What's happening today/tomorrow?" → Reference upcomingActivities.today or upcomingActivities.tomorrow
- "Any tasks due soon?" → Reference tasks.dueToday, tasks.dueTomorrow, tasks.dueThisWeek
- "What's on my schedule?" → Reference calendarEvents.today, calendarEvents.tomorrow
- "Any reminders?" → Reference reminders.dueToday, reminders.dueTomorrow
- "Latest updates?" → Reference latestUpdates (notifications, completedAssignments, completedTasks)
- "What did I accomplish?" → Reference completedTasks, completedAssignments
- "Show me my notes" → Reference notes.recent, notes.todayNotes
- "What integrations are connected?" → Reference integration summary (Google, Microsoft, Social Media, etc.)
- "Can you access my [service]?" → Check integration status and permissions
- "Read my location/contacts/photos" → Check device permissions first
- "Send email/message" → Verify email/communication integrations are connected

CONTEXT AWARENESS:
- Know what integrations are connected and suggest connecting missing ones
- Reference user's current data when answering questions (use specific numbers and details from Quick Actions data)
- Provide personalized responses based on user's profile and activity
- Be proactive in suggesting optimizations and improvements

RESPONSE STYLE:
- Friendly and conversational using the user's name (${user?.preferredName || user?.fullName || 'there'})
- Concise but informative
- Proactive in offering help
- Reference specific data when relevant (e.g., "You have 5 tasks due today, 3 reminders set, and 2 calendar events")
- When listing activities, organize by time (today first, then tomorrow, then this week)

Always maintain context from previous messages in the conversation.`
      });

      // Add context about actions taken
      if (actionsExecuted.length > 0) {
        chatMessages.push({
          role: 'system',
          content: `You just successfully executed these actions: ${actionsExecuted.map(a => `${a.type}: ${a.data.title}`).join(', ')}. Confirm this to the user in a friendly way.`
        });
      }

      // Get AI response
      const aiResponse = await openaiService.generateChatCompletion(
        chatMessages,
        userId as string,
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

      // Generate TTS audio for AI response using user's selected voice
      let audioBuffer = null;
      if (user?.assistantVoice && aiResponse.message) {
        console.log(`🔊 Generating TTS with voice: ${user.assistantVoice}`);
        try {
          audioBuffer = await openaiService.generateSpeech(aiResponse.message, user.assistantVoice);
          console.log(`✅ TTS audio generated successfully`);
        } catch (ttsError) {
          console.error('❌ TTS generation failed:', ttsError);
          // Continue without audio if TTS fails
        }
      }

      // Return both transcription and AI response
      res.json({
        success: true,
        data: {
          conversationId: conversation._id,
          transcript: transcribedText,
          aiResponse: aiResponse.message,
          audioBuffer: audioBuffer ? audioBuffer.toString('base64') : null, // Send as base64
          voice: user?.assistantVoice || 'alloy',
          messages: conversation.messages.slice(-2), // User message + AI response
          actionsExecuted: actionsExecuted.map(a => ({
            type: a.type,
            id: a.data._id,
            title: a.data.title
          })), // Return info about created items
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
      const userId = req.userId;
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

  // Get text-only chat history (simple format)
  async getChatHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { limit = 50, conversationId } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      let conversations;
      if (conversationId) {
        // Get specific conversation
        const conversation = await Conversation.findOne({ _id: conversationId, userId });
        conversations = conversation ? [conversation] : [];
      } else {
        // Get all recent conversations
        conversations = await Conversation.find({ userId })
          .sort({ updatedAt: -1 })
          .limit(parseInt(limit as string));
      }

      // Extract text-only messages
      const chatHistory = conversations.map(conv => ({
        conversationId: conv._id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: conv.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      }));

      res.json({
        success: true,
        data: {
          conversations: chatHistory,
          totalConversations: chatHistory.length,
        },
        message: 'Chat history retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chat history',
      });
    }
  },

  // Get all messages in simple text format (consolidated across conversations)
  async getAllMessages(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { limit = 100 } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Get all conversations
      const conversations = await Conversation.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(parseInt(limit as string));

      // Flatten all messages from all conversations
      const allMessages: any[] = [];
      conversations.forEach(conv => {
        conv.messages.forEach(msg => {
          allMessages.push({
            conversationId: conv._id,
            conversationTitle: conv.title,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          });
        });
      });

      // Sort by timestamp (most recent first)
      allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({
        success: true,
        data: {
          messages: allMessages.slice(0, parseInt(limit as string)),
          totalMessages: allMessages.length,
        },
        message: 'All messages retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting all messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve messages',
      });
    }
  },

  // Extract tasks, events, and reminders from conversation text
  async extractTasksFromConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { conversationText } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

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
        userId as string,
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

  // Get conversation stats and memory analytics
  async getConversationStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const stats = await ConversationMemoryService.getUserConversationStats(userId);

      res.json({
        success: true,
        data: stats,
        message: 'Conversation stats retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conversation stats',
      });
    }
  },

  // Manually trigger conversation summarization
  async summarizeConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Verify ownership
      const conversation = await Conversation.findOne({ _id: id, userId });
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const summary = await ConversationMemoryService.summarizeConversation(id);

      if (!summary) {
        return res.status(400).json({
          success: false,
          error: 'Failed to summarize conversation (may be too short)',
        });
      }

      res.json({
        success: true,
        data: summary,
        message: 'Conversation summarized successfully',
      });
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to summarize conversation',
      });
    }
  },

  // Archive old conversations
  async archiveOldConversations(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { daysOld = 90 } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const archivedCount = await ConversationMemoryService.archiveOldConversations(
        userId,
        parseInt(daysOld as string)
      );

      res.json({
        success: true,
        data: { archivedCount },
        message: `Archived ${archivedCount} conversations`,
      });
    } catch (error) {
      console.error('Error archiving conversations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to archive conversations',
      });
    }
  },
};