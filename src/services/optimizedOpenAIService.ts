import OpenAI from 'openai';
import { User } from '../models';
import { buildOptimizedPrompt, PromptContext } from '../prompts/modularPrompts';
import ProfileLearningService from './ProfileLearningService';
import logger from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Structured PA Response - Single AI call returns everything
 */
export interface PAStructuredResponse {
  hasActions: boolean;
  needsClarification: boolean;
  clarificationNeeded: string | null;
  needsPermission: boolean;
  permissionsNeeded: string[];
  permissionReason: string | null;

  tasks: Array<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    dueDate: string | null;
  }>;
  assignments: Array<{
    title: string;
    description: string;
    query: string;
    type: 'research' | 'comparison' | 'recommendation' | 'investigation' | 'analysis';
    priority: 'low' | 'medium' | 'high';
  }>;
  reminders: Array<{
    title: string;
    notes: string;
    reminderTime: string;
    isUrgent: boolean;
  }>;
  notes: Array<{
    title: string;
    content: string;
    category: 'personal' | 'work' | 'idea' | 'urgent';
  }>;
  calendarEvents: Array<{
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    location: string;
    attendees: string[];
  }>;

  conversationalResponse: string;
}

export class OptimizedOpenAIService {
  /**
   * SINGLE AI CALL - Returns both actions and conversational response
   *
   * This replaces the old two-call approach:
   * OLD: Intent detection call + Conversational response call = 2x cost, 2x latency
   * NEW: Single structured call = 50% cost, 50% faster
   */
  async generateStructuredResponse(
    userMessage: string,
    userId: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    assistantName: string = 'Yo!',
    mode: 'text' | 'voice' = 'text'
  ): Promise<{
    success: boolean;
    data?: PAStructuredResponse;
    error?: string;
  }> {
    const isVoiceMode = mode === 'voice';
    try {
      // Fetch user info for personalization
      const user = await User.findById(userId);
      const userName = user?.preferredName || user?.fullName;

      // Fetch user profile for learned preferences
      const profile = await ProfileLearningService.getOrCreateProfile(userId);

      // Detect conversation phase
      const isGreeting = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|what's up|whats up)/i.test(
        userMessage.trim()
      );

      // Detect user mood from message sentiment
      let userMood: 'positive' | 'neutral' | 'negative' | 'urgent' = 'neutral';
      const urgentKeywords = /\b(asap|urgent|emergency|immediately|right now|hurry|quick)\b/i;
      const positiveKeywords = /\b(great|awesome|thanks|amazing|perfect|excellent|love)\b/i;
      const negativeKeywords = /\b(frustrated|angry|annoyed|upset|problem|issue|wrong|broken)\b/i;

      if (urgentKeywords.test(userMessage)) userMood = 'urgent';
      else if (positiveKeywords.test(userMessage)) userMood = 'positive';
      else if (negativeKeywords.test(userMessage)) userMood = 'negative';

      // Build context for prompt optimization with learned preferences
      const promptContext: PromptContext = {
        assistantName,
        userName,
        conversationPhase: isGreeting ? 'greeting' : 'task',
        userMood,
        userPreferences: {
          communicationStyle: profile.communicationStyle === 'casual' ? 'casual' : 'formal',
          preferredGreeting: profile.preferredGreeting,
        },
      };

      // Build optimized system prompt (only includes what's needed)
      let systemPrompt = buildOptimizedPrompt(promptContext, userMessage);

      // Inject learned profile data into prompt
      const profileSummary = await ProfileLearningService.getProfileSummary(userId);
      if (profileSummary) {
        systemPrompt += `\n\n${profileSummary}`;
      }

      // ==========================================
      // INJECT PA CONTEXT - CRITICAL FOR PA TO WORK!
      // ==========================================
      // The PA MUST have access to user's calendar, emails, tasks, integrations, etc.
      // Without this, PA can't answer questions like "What's on my calendar?" or "Read my emails"
      const paContextService = (await import('./paContextService')).default;
      const quickActionsService = (await import('./quickActionsAggregatorService')).default;
      const integrationService = (await import('./integrationAggregatorService')).default;

      const [contextSummary, quickActionsSummary, integrationSummary] = await Promise.all([
        paContextService.getContextSummary(userId),
        quickActionsService.generateQuickActionsSummary(userId),
        integrationService.generateIntegrationSummary(userId)
      ]);

      // Add mode-specific instructions
      systemPrompt += `\n\n${isVoiceMode ? `
🎤 VOICE MODE ACTIVATED 🎤
The user is speaking to you via voice. Your response will be read aloud to them.
IMPORTANT VOICE RESPONSE RULES:
- Keep responses SHORT and CONVERSATIONAL (1-3 sentences max in conversationalResponse field)
- Use natural spoken language, not written text
- NO markdown, NO links, NO formatting in conversationalResponse
- Be CONCISE and TO THE POINT
- Examples:
  ✅ "Got it! I've added that task for tomorrow."
  ✅ "You have 3 tasks due today and 2 meetings this afternoon."
  ❌ "I've successfully created a task for you. Here are the details: [long explanation]"
` : `
💬 TEXT CHAT MODE 💬
The user is typing to you. You can provide detailed, formatted responses.
TEXT RESPONSE STYLE:
- Can be detailed and comprehensive in conversationalResponse field
- Use markdown formatting (bold, lists, links)
- Include relevant details and context
- Provide actionable information
`}

═══════════════════════════════════════════════════════════
📊 PA CONTEXT - COMPLETE ACCESS TO USER'S DATA
═══════════════════════════════════════════════════════════

${contextSummary}

═══════════════════════════════════════════════════════════
📱 QUICK ACTIONS DASHBOARD - COMPREHENSIVE USER DATA
═══════════════════════════════════════════════════════════

${quickActionsSummary}

${integrationSummary}

IMPORTANT QUERY HANDLING:
When the user asks about:
- "What's happening today/tomorrow?" → Reference upcomingActivities.today or upcomingActivities.tomorrow
- "Any tasks due soon?" → Reference tasks.dueToday, tasks.dueTomorrow, tasks.dueThisWeek
- "What's on my schedule?" → Reference calendarEvents.today, calendarEvents.tomorrow
- "Any reminders?" → Reference reminders.dueToday, reminders.dueTomorrow
- "Latest updates?" → Reference latestUpdates (notifications, completedAssignments, completedTasks)
- "What did I accomplish?" → Reference completedTasks, completedAssignments
- "Show me my notes" → Reference notes.recent, notes.todayNotes
- "What integrations are connected?" → Reference integration summary
- "Can you access my [service]?" → Check integration status
- "Read my emails/calendar/contacts" → Check if integration is connected, then use real data

CONTEXT AWARENESS:
- Know what integrations are connected and suggest connecting missing ones
- Reference user's current data when answering questions (use specific numbers and details)
- Provide personalized responses based on user's profile and activity
- Be proactive in suggesting optimizations`;

      logger.info(`[OptimizedOpenAI] Generating response for user ${userId}`);
      logger.info(`[OptimizedOpenAI] Prompt size: ~${Math.ceil(systemPrompt.length / 4)} tokens (now includes PA context)`);

      // Prepare messages with conversation history
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        // Add last 5 messages of conversation history for context
        ...conversationHistory.slice(-5).map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: userMessage,
        },
      ];

      // Single AI call with JSON response
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 800, // Enough for actions + response
        response_format: { type: 'json_object' }, // Force JSON output
        user: userId,
      });

      const responseText = completion.choices[0]?.message?.content;

      if (!responseText) {
        return {
          success: false,
          error: 'No response from OpenAI',
        };
      }

      // Parse JSON response
      let parsedResponse: PAStructuredResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        logger.error('[OptimizedOpenAI] Failed to parse JSON response:', parseError);
        logger.error('[OptimizedOpenAI] Raw response:', responseText);

        return {
          success: false,
          error: 'Failed to parse AI response',
        };
      }

      // Validate required fields
      if (!parsedResponse.conversationalResponse) {
        return {
          success: false,
          error: 'Missing conversationalResponse in AI response',
        };
      }

      // Set defaults for optional fields
      parsedResponse.tasks = parsedResponse.tasks || [];
      parsedResponse.assignments = parsedResponse.assignments || [];
      parsedResponse.reminders = parsedResponse.reminders || [];
      parsedResponse.notes = parsedResponse.notes || [];
      parsedResponse.calendarEvents = parsedResponse.calendarEvents || [];
      parsedResponse.permissionsNeeded = parsedResponse.permissionsNeeded || [];

      logger.info(`[OptimizedOpenAI] Response generated successfully`);
      logger.info(`[OptimizedOpenAI] Actions detected:`, {
        tasks: parsedResponse.tasks.length,
        assignments: parsedResponse.assignments.length,
        reminders: parsedResponse.reminders.length,
        needsClarification: parsedResponse.needsClarification,
        needsPermission: parsedResponse.needsPermission,
      });

      return {
        success: true,
        data: parsedResponse,
      };
    } catch (error: any) {
      logger.error('[OptimizedOpenAI] Error generating response:', error);

      // Handle specific OpenAI errors
      if (error.code === 'insufficient_quota') {
        return {
          success: false,
          error: 'OpenAI API quota exceeded',
        };
      }

      if (error.code === 'rate_limit_exceeded') {
        return {
          success: false,
          error: 'Rate limit exceeded, please try again in a moment',
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to generate response',
      };
    }
  }

  /**
   * Estimate token usage for transparency
   */
  estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

export const optimizedOpenAIService = new OptimizedOpenAIService();
