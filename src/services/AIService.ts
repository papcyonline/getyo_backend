import OpenAI from 'openai';
import { AIResponse } from '../types';

class AIService {
  private openai: OpenAI;
  private systemPrompt: string;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.systemPrompt = `You are Yo!, a friendly, helpful, and conversational AI personal assistant. Your personality is warm, approachable, and human-like, not robotic. You help users with:

1. Task and schedule management
2. Setting reminders and notifications
3. Answering questions and providing assistance
4. Creating summaries and extracting action items
5. Offering productivity tips and suggestions
6. **Accessing integrated services** (Calendar, Contacts, Location, Email, etc.) when connected

**Integration Capabilities:**
When users have connected their services, you have access to:
- **Calendar events** from Google Calendar, Outlook Calendar, or Apple Calendar
- **Contacts** from their device for quick communication
- **Location data** for navigation and location-based suggestions
- **Email** for reading, summarizing, or composing messages
- **And more** as they connect additional integrations

**Key guidelines:**
- Be conversational and friendly, like talking to a good friend
- Use casual language appropriate for the user's style
- **Use integration data naturally** - reference their actual calendar events, location, etc.
- Offer specific, actionable suggestions based on their real data
- Ask follow-up questions when needed
- Extract action items from conversations when relevant
- Keep responses concise but helpful
- Show enthusiasm and positivity when appropriate
- **When users ask about calendar, contacts, or other integrated data, provide specific information from the context**

When users ask about their schedule, tasks, or need reminders, provide specific and helpful responses using their actual integrated data. If you detect tasks or events in the conversation, suggest adding them to their list.

If users ask about data from a service they haven't connected yet, politely suggest they connect that integration for better assistance.`;
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    userContext?: {
      name?: string;
      upcomingEvents?: any[];
      pendingTasks?: any[];
      preferences?: any;
      // Integration data
      calendarEvents?: any[];
      contacts?: any[];
      location?: { latitude: number; longitude: number; address?: string };
      emails?: any[];
      integrations?: {
        googleCalendar?: boolean;
        outlookCalendar?: boolean;
        appleCalendar?: boolean;
        contacts?: boolean;
        location?: boolean;
      };
    }
  ): Promise<AIResponse> {
    try {
      // Build context information with integration data
      let contextPrompt = '';
      if (userContext) {
        if (userContext.name) {
          contextPrompt += `The user's name is ${userContext.name}. `;
        }

        // Calendar events from all connected calendars
        if (userContext.calendarEvents && userContext.calendarEvents.length > 0) {
          const todayEvents = userContext.calendarEvents.filter(e => {
            const eventDate = new Date(e.startTime);
            const today = new Date();
            return eventDate.toDateString() === today.toDateString();
          });

          const upcomingEvents = userContext.calendarEvents.filter(e => {
            const eventDate = new Date(e.startTime);
            const today = new Date();
            return eventDate > today && eventDate.toDateString() !== today.toDateString();
          });

          if (todayEvents.length > 0) {
            contextPrompt += `\n\nToday's calendar events:\n${todayEvents.map(e =>
              `- ${e.title} at ${new Date(e.startTime).toLocaleTimeString()} ${e.location ? `(${e.location})` : ''}`
            ).join('\n')}`;
          }

          if (upcomingEvents.length > 0) {
            contextPrompt += `\n\nUpcoming events:\n${upcomingEvents.slice(0, 5).map(e =>
              `- ${e.title} on ${new Date(e.startTime).toLocaleDateString()} at ${new Date(e.startTime).toLocaleTimeString()}`
            ).join('\n')}`;
          }

          // Note which calendars are connected
          const connectedCalendars = [];
          if (userContext.integrations?.googleCalendar) connectedCalendars.push('Google Calendar');
          if (userContext.integrations?.outlookCalendar) connectedCalendars.push('Outlook Calendar');
          if (userContext.integrations?.appleCalendar) connectedCalendars.push('Apple Calendar');

          if (connectedCalendars.length > 0) {
            contextPrompt += `\n(Events synced from: ${connectedCalendars.join(', ')})`;
          }
        }

        // Pending tasks
        if (userContext.pendingTasks && userContext.pendingTasks.length > 0) {
          contextPrompt += `\n\nPending tasks:\n${userContext.pendingTasks.map(t =>
            `- ${t.title} (${t.priority} priority${t.dueDate ? `, due ${new Date(t.dueDate).toLocaleDateString()}` : ''})`
          ).join('\n')}`;
        }

        // Location context
        if (userContext.location) {
          contextPrompt += `\n\nUser's current location: ${userContext.location.address || `${userContext.location.latitude}, ${userContext.location.longitude}`}`;
        }

        // Contact information (for queries like "Call John" or "Email Sarah")
        if (userContext.contacts && userContext.contacts.length > 0) {
          // Only include if the message mentions contacting someone
          if (/(?:call|text|message|email|contact)\s+(\w+)/i.test(userMessage)) {
            contextPrompt += `\n\nUser has access to contacts (device contacts connected).`;
          }
        }

        // Email context (for queries about emails)
        if (userContext.emails && userContext.emails.length > 0) {
          if (/(?:email|inbox|mail|message)/i.test(userMessage)) {
            const unreadCount = userContext.emails.filter(e => !e.isRead).length;
            contextPrompt += `\n\nUser has ${unreadCount} unread email${unreadCount !== 1 ? 's' : ''}. Recent emails available for summary.`;
          }
        }

        // User preferences
        if (userContext.preferences) {
          contextPrompt += `\n\nUser preferences: ${userContext.preferences.conversationStyle} style, ${userContext.preferences.reminderStyle} reminders.`;
        }
      }

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: this.systemPrompt + (contextPrompt ? `\n\nContext: ${contextPrompt}` : '') },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const responseContent = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that request.";

      // Extract action items using a second AI call if the response seems to contain tasks/events
      const actionItems = await this.extractActionItems(userMessage, responseContent);

      return {
        content: responseContent,
        actionItems: actionItems.length > 0 ? actionItems : undefined,
        context: {
          tokens_used: completion.usage?.total_tokens || 0,
          model_used: 'gpt-4',
          confidence: 0.9, // GPT-4 typically has high confidence
        },
      };
    } catch (error) {
      console.error('AI Service Error:', error);
      return {
        content: "I'm having trouble processing your request right now. Please try again in a moment.",
        context: { error: true },
      };
    }
  }

  private async extractActionItems(userMessage: string, aiResponse: string): Promise<string[]> {
    try {
      // Check if the conversation mentions tasks, reminders, or scheduling
      const hasActionKeywords = /(?:remind|task|todo|schedule|meeting|appointment|deadline|add to|create|set up)/i.test(
        userMessage + ' ' + aiResponse
      );

      if (!hasActionKeywords) {
        return [];
      }

      const extractionPrompt = `Analyze the following conversation and extract any specific action items, tasks, or reminders that were mentioned or implied. Return only concrete, actionable items as a JSON array of strings. If no action items are present, return an empty array.

User: ${userMessage}
Assistant: ${aiResponse}

Extract action items as JSON array:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a precise action item extractor. Return only a JSON array of specific action items.' },
          { role: 'user', content: extractionPrompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const result = completion.choices[0]?.message?.content || '[]';

      try {
        const actionItems = JSON.parse(result);
        return Array.isArray(actionItems) ? actionItems : [];
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Action item extraction error:', error);
      return [];
    }
  }

  async summarizeTranscript(
    transcript: string,
    participants?: string[],
    extractActionItems: boolean = true
  ): Promise<{ summary: string; actionItems: string[]; keyTopics: string[] }> {
    try {
      const prompt = `Please analyze this transcript and provide:
1. A concise summary of the main points discussed
2. Any action items or tasks mentioned (if any)
3. Key topics or themes

Transcript:
${transcript}

${participants ? `Participants: ${participants.join(', ')}` : ''}

Format the response as JSON with "summary", "actionItems" (array), and "keyTopics" (array) fields.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that analyzes meeting transcripts and extracts key information.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const result = completion.choices[0]?.message?.content || '{}';

      try {
        const parsed = JSON.parse(result);
        return {
          summary: parsed.summary || 'No summary available',
          actionItems: parsed.actionItems || [],
          keyTopics: parsed.keyTopics || [],
        };
      } catch {
        return {
          summary: result,
          actionItems: [],
          keyTopics: [],
        };
      }
    } catch (error) {
      console.error('Transcript summarization error:', error);
      return {
        summary: 'Error processing transcript',
        actionItems: [],
        keyTopics: [],
      };
    }
  }

  async generateDailyBriefing(userContext: {
    name: string;
    todayEvents: any[];
    pendingTasks: any[];
    weather?: { temperature: number; condition: string; };
    reminderStyle: 'casual' | 'formal' | 'friendly';
  }): Promise<string> {
    try {
      const { name, todayEvents, pendingTasks, weather, reminderStyle } = userContext;

      const prompt = `Generate a ${reminderStyle} daily briefing for ${name}. Include:

Today's Events:
${todayEvents.length > 0
  ? todayEvents.map(e => `- ${e.title} at ${new Date(e.startTime).toLocaleTimeString()}`).join('\n')
  : '- No events scheduled'
}

Priority Tasks:
${pendingTasks.length > 0
  ? pendingTasks.map(t => `- ${t.title} (${t.priority} priority)`).join('\n')
  : '- No pending tasks'
}

${weather ? `Weather: ${weather.temperature}°F, ${weather.condition}` : ''}

Make it motivational and helpful, matching the ${reminderStyle} style. Keep it concise but warm.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are Yo!, generating a ${reminderStyle} daily briefing. Be encouraging and specific.` },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 300,
      });

      return completion.choices[0]?.message?.content || `Good morning, ${name}! Have a great day ahead!`;
    } catch (error) {
      console.error('Daily briefing generation error:', error);
      return `Good morning! Ready to tackle the day?`;
    }
  }

  async analyzeIntent(userMessage: string): Promise<{
    intent: string;
    entities: Record<string, any>;
    confidence: number;
  }> {
    try {
      const prompt = `Analyze this user message and determine the intent and extract entities.

User message: "${userMessage}"

Classify the intent as one of:
- create_task: User wants to create a task or reminder
- schedule_event: User wants to schedule an event or meeting
- ask_question: User is asking for information
- get_summary: User wants a summary or status update
- manage_existing: User wants to modify existing tasks/events
- casual_chat: Just casual conversation

Extract entities like dates, times, people, locations, task descriptions, etc.

Return as JSON: {"intent": "intent_name", "entities": {}, "confidence": 0.0-1.0}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an intent classification system. Always return valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const result = completion.choices[0]?.message?.content || '{}';

      try {
        const parsed = JSON.parse(result);
        return {
          intent: parsed.intent || 'casual_chat',
          entities: parsed.entities || {},
          confidence: parsed.confidence || 0.5,
        };
      } catch {
        return {
          intent: 'casual_chat',
          entities: {},
          confidence: 0.3,
        };
      }
    } catch (error) {
      console.error('Intent analysis error:', error);
      return {
        intent: 'casual_chat',
        entities: {},
        confidence: 0.1,
      };
    }
  }
}

export default new AIService();