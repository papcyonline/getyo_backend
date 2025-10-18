import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import { AuthRequest } from '../types';
import { openaiService, ChatMessage } from '../services/openaiService';
import { User } from '../models';

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
      const { message, conversationId } = req.body;

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
                  status: 'pending',
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
                    status: 'in_progress',
                  });
                  await assignment.save();
                  console.log(`🎯 Assignment created: ${assignment.title}`);

                  // PA performs the research immediately (async)
                  // In production, this would be a background job
                  try {
                    const researchPrompt = `You are a research assistant. The user asked: "${assignmentData.query}"

Perform comprehensive research and provide:
1. A clear, concise summary (2-3 sentences)
2. Key findings (3-5 bullet points)
3. Relevant data or recommendations
4. Sources or references if applicable

Format your response as structured information that can be displayed in a notification.`;

                    const researchResponse = await openaiService.generateChatCompletion(
                      [{ role: 'user', content: researchPrompt }],
                      userId as string,
                      assistantName
                    );

                    if (researchResponse.success && researchResponse.message) {
                      // Update assignment with findings
                      assignment.findings = researchResponse.message;
                      assignment.status = 'completed';
                      assignment.completedAt = new Date();
                      await assignment.save();

                      // Auto-create note with research findings
                      const researchNote = new Note({
                        userId,
                        title: `Research: ${assignment.title}`,
                        content: researchResponse.message,
                        category: 'research',
                        tags: [assignment.type, 'pa-research', 'auto-generated'],
                        metadata: {
                          assignmentId: String(assignment._id),
                          query: assignment.query,
                          completedAt: new Date(),
                          source: 'assignment',
                        },
                      });
                      await researchNote.save();
                      console.log(`📝 Auto-created note from assignment: ${researchNote.title}`);

                      // Create notification with findings
                      await Notification.createNotification({
                        userId: userId as string,
                        type: 'ai_suggestion',
                        title: `Assignment Complete: ${assignment.title}`,
                        message: `Your PA has completed research on: ${assignment.title}\n\n${researchResponse.message}`,
                        priority: 'high',
                        relatedId: String(assignment._id),
                        relatedModel: 'Assignment',
                        actionUrl: `/assignments/${String(assignment._id)}`,
                        metadata: {
                          assignmentType: assignment.type,
                          query: assignment.query,
                          noteId: String(researchNote._id),
                        },
                      });

                      assignment.notificationSent = true;
                      await assignment.save();

                      console.log(`✅ Assignment completed and notification sent: ${assignment.title}`);
                    }
                  } catch (researchError) {
                    console.error('Research failed:', researchError);
                    assignment.status = 'failed';
                    await assignment.save();
                  }

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

      // GET COMPREHENSIVE PA CONTEXT
      const paContextService = (await import('../services/paContextService')).default;
      const contextSummary = await paContextService.getContextSummary(userId as string);

      // Prepare messages for OpenAI response (convert format)
      const chatMessages: ChatMessage[] = conversation.messages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Add PA context at the beginning (so AI knows everything about the user)
      chatMessages.unshift({
        role: 'system',
        content: `You are ${assistantName}, an intelligent personal assistant with complete access to the user's data and app. Here is the current context:

${contextSummary}

CAPABILITIES:
You can:
1. CREATE: Tasks, Reminders, Notes, Calendar Events, Email Drafts, Meetings
2. QUERY: Answer questions about user's data, integrations, schedule, productivity
3. ANALYZE: Provide insights, summaries, analytics
4. MANAGE: Guide users on connecting integrations, updating settings
5. SEARCH: Find emails, tasks, calendar events, notes

CONTEXT AWARENESS:
- Know what integrations are connected and suggest connecting missing ones
- Reference user's current data when answering questions
- Provide personalized responses based on user's profile and activity
- Be proactive in suggesting optimizations and improvements

RESPONSE STYLE:
- Friendly and conversational using the user's name (${user?.name || 'there'})
- Concise but informative
- Proactive in offering help
- Reference specific data when relevant (e.g., "You have 5 tasks due today")

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
                  status: 'pending',
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
                    status: 'in_progress',
                  });
                  await assignment.save();
                  console.log(`🎯 Assignment created from voice: ${assignment.title}`);

                  // PA performs the research immediately
                  try {
                    const researchPrompt = `You are a research assistant. The user asked: "${assignmentData.query}"

Perform comprehensive research and provide:
1. A clear, concise summary (2-3 sentences)
2. Key findings (3-5 bullet points)
3. Relevant data or recommendations
4. Sources or references if applicable

Format your response as structured information that can be displayed in a notification.`;

                    const researchResponse = await openaiService.generateChatCompletion(
                      [{ role: 'user', content: researchPrompt }],
                      userId as string,
                      assistantName
                    );

                    if (researchResponse.success && researchResponse.message) {
                      assignment.findings = researchResponse.message;
                      assignment.status = 'completed';
                      assignment.completedAt = new Date();
                      await assignment.save();

                      // Auto-create note with research findings
                      const researchNote = new Note({
                        userId,
                        title: `Research: ${assignment.title}`,
                        content: researchResponse.message,
                        category: 'research',
                        tags: [assignment.type, 'pa-research', 'auto-generated', 'voice'],
                        metadata: {
                          assignmentId: String(assignment._id),
                          query: assignment.query,
                          completedAt: new Date(),
                          source: 'assignment-voice',
                        },
                      });
                      await researchNote.save();
                      console.log(`📝 Auto-created note from voice assignment: ${researchNote.title}`);

                      // Create notification with findings
                      await Notification.createNotification({
                        userId: userId as string,
                        type: 'ai_suggestion',
                        title: `Assignment Complete: ${assignment.title}`,
                        message: `Your PA has completed research on: ${assignment.title}\n\n${researchResponse.message}`,
                        priority: 'high',
                        relatedId: String(assignment._id),
                        relatedModel: 'Assignment',
                        actionUrl: `/assignments/${String(assignment._id)}`,
                        metadata: {
                          assignmentType: assignment.type,
                          query: assignment.query,
                          noteId: String(researchNote._id),
                        },
                      });

                      assignment.notificationSent = true;
                      await assignment.save();

                      console.log(`✅ Assignment from voice completed and notification sent: ${assignment.title}`);
                    }
                  } catch (researchError) {
                    console.error('Voice research failed:', researchError);
                    assignment.status = 'failed';
                    await assignment.save();
                  }

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

      // GET COMPREHENSIVE PA CONTEXT (same as sendMessage)
      const paContextService = (await import('../services/paContextService')).default;
      const contextSummary = await paContextService.getContextSummary(userId as string);

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

CAPABILITIES:
You can:
1. CREATE: Tasks, Reminders, Notes, Calendar Events, Email Drafts, Meetings
2. QUERY: Answer questions about user's data, integrations, schedule, productivity
3. ANALYZE: Provide insights, summaries, analytics
4. MANAGE: Guide users on connecting integrations, updating settings
5. SEARCH: Find emails, tasks, calendar events, notes

CONTEXT AWARENESS:
- Know what integrations are connected and suggest connecting missing ones
- Reference user's current data when answering questions
- Provide personalized responses based on user's profile and activity
- Be proactive in suggesting optimizations and improvements

RESPONSE STYLE:
- Friendly and conversational using the user's name (${user?.name || 'there'})
- Concise but informative
- Proactive in offering help
- Reference specific data when relevant (e.g., "You have 5 tasks due today")

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
};