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
    assistantName: string = 'Yo!'
  ): Promise<{
    success: boolean;
    data?: PAStructuredResponse;
    error?: string;
  }> {
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

      logger.info(`[OptimizedOpenAI] Generating response for user ${userId}`);
      logger.info(`[OptimizedOpenAI] Prompt size: ~${Math.ceil(systemPrompt.length / 4)} tokens (vs ~2000 old)`);

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
