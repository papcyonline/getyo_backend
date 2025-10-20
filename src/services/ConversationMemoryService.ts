import Conversation from '../models/Conversation';
import { openaiService } from '../services/openaiService';
import logger from '../utils/logger';

/**
 * Conversation Memory Service
 *
 * Handles intelligent context persistence:
 * - Automatic conversation summarization
 * - Topic and entity extraction
 * - Long-term memory across conversations
 * - Smart context retrieval
 */

interface ConversationSummary {
  mainTopics: string[];
  keyEntities: {
    people: string[];
    places: string[];
    projects: string[];
    preferences: string[];
  };
  actionableItems: string[];
  userPreferences: string[];
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface MemoryContext {
  recentSummary: string;
  relevantPastContext: string[];
  userPreferences: Record<string, any>;
  mentionedEntities: string[];
}

class ConversationMemoryService {
  /**
   * Summarize a conversation when it gets too long (>20 messages)
   */
  async summarizeConversation(conversationId: string): Promise<ConversationSummary | null> {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        logger.error(`[ConversationMemory] Conversation not found: ${conversationId}`);
        return null;
      }

      // Only summarize if conversation has enough messages
      if (conversation.messages.length < 10) {
        logger.info(`[ConversationMemory] Conversation too short to summarize: ${conversation.messages.length} messages`);
        return null;
      }

      // Convert messages to text
      const conversationText = conversation.messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      const summarizationPrompt = `Analyze the following conversation and extract key information.

CONVERSATION:
${conversationText}

Extract and return a JSON object with this structure:
{
  "mainTopics": ["topic1", "topic2", ...],
  "keyEntities": {
    "people": ["person names mentioned"],
    "places": ["locations mentioned"],
    "projects": ["projects or work items mentioned"],
    "preferences": ["user preferences discovered (e.g., 'prefers morning meetings', 'likes coffee')"]
  },
  "actionableItems": ["items that require follow-up"],
  "userPreferences": ["learned preferences about the user"],
  "summary": "2-3 sentence summary of the conversation",
  "sentiment": "positive" | "neutral" | "negative"
}

Focus on extracting information that would be useful for future conversations.`;

      const response = await openaiService.generateChatCompletion(
        [{ role: 'user', content: summarizationPrompt }],
        conversation.userId,
        'Memory'
      );

      if (!response.success || !response.message) {
        logger.error('[ConversationMemory] Failed to generate summary');
        return null;
      }

      // Parse response
      let summaryData: ConversationSummary;
      try {
        const cleanedResponse = response.message
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        summaryData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        logger.error('[ConversationMemory] Failed to parse summary:', parseError);
        return null;
      }

      // Store summary in conversation context
      await Conversation.findByIdAndUpdate(conversationId, {
        $set: {
          'context.summary': summaryData.summary,
          'context.mainTopics': summaryData.mainTopics,
          'context.keyEntities': summaryData.keyEntities,
          'context.sentiment': summaryData.sentiment,
          'context.lastSummarized': new Date(),
        },
      });

      logger.info(`[ConversationMemory] ✅ Summarized conversation: ${conversationId}`);
      return summaryData;
    } catch (error) {
      logger.error('[ConversationMemory] Error summarizing conversation:', error);
      return null;
    }
  }

  /**
   * Get relevant context from past conversations for the current conversation
   */
  async getRelevantContext(userId: string, currentMessage: string, limit: number = 5): Promise<MemoryContext> {
    try {
      // Get recent conversations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentConversations = await Conversation.find({
        userId,
        updatedAt: { $gte: thirtyDaysAgo },
      })
        .sort({ updatedAt: -1 })
        .limit(20) // Check last 20 conversations
        .select('messages context');

      // Extract topics/keywords from current message
      const currentTopics = this.extractTopics(currentMessage);

      // Find conversations with similar topics
      const relevantConversations: Array<{ score: number; conversation: any }> = [];

      for (const conv of recentConversations) {
        // Skip if no context summary
        if (!conv.context?.summary && !conv.context?.mainTopics) {
          continue;
        }

        // Calculate relevance score
        let score = 0;

        // Check topic overlap
        if (conv.context.mainTopics && Array.isArray(conv.context.mainTopics)) {
          const topicOverlap = conv.context.mainTopics.filter((topic: string) =>
            currentTopics.some(currTopic =>
              topic.toLowerCase().includes(currTopic.toLowerCase()) ||
              currTopic.toLowerCase().includes(topic.toLowerCase())
            )
          );
          score += topicOverlap.length * 2;
        }

        // Check entity mentions in summary
        if (conv.context.summary) {
          const summaryLower = conv.context.summary.toLowerCase();
          currentTopics.forEach(topic => {
            if (summaryLower.includes(topic.toLowerCase())) {
              score += 1;
            }
          });
        }

        if (score > 0) {
          relevantConversations.push({ score, conversation: conv });
        }
      }

      // Sort by relevance score and take top N
      relevantConversations.sort((a, b) => b.score - a.score);
      const topRelevant = relevantConversations.slice(0, limit);

      // Build context
      const memoryContext: MemoryContext = {
        recentSummary: '',
        relevantPastContext: [],
        userPreferences: {},
        mentionedEntities: [],
      };

      // Get most recent conversation summary
      if (recentConversations.length > 0 && recentConversations[0].context?.summary) {
        memoryContext.recentSummary = `Recent conversation: ${recentConversations[0].context.summary}`;
      }

      // Add relevant past context
      for (const { conversation } of topRelevant) {
        if (conversation.context?.summary) {
          memoryContext.relevantPastContext.push(conversation.context.summary);
        }
      }

      // Extract user preferences from all conversations
      for (const conv of recentConversations) {
        if (conv.context?.keyEntities?.preferences) {
          conv.context.keyEntities.preferences.forEach((pref: string) => {
            const prefKey = pref.split(':')[0]?.trim().toLowerCase();
            if (prefKey) {
              memoryContext.userPreferences[prefKey] = pref;
            }
          });
        }
      }

      // Extract mentioned entities
      for (const { conversation } of topRelevant) {
        if (conversation.context?.keyEntities) {
          const entities = conversation.context.keyEntities;
          if (entities.people) memoryContext.mentionedEntities.push(...entities.people);
          if (entities.places) memoryContext.mentionedEntities.push(...entities.places);
          if (entities.projects) memoryContext.mentionedEntities.push(...entities.projects);
        }
      }

      // Deduplicate entities
      memoryContext.mentionedEntities = [...new Set(memoryContext.mentionedEntities)];

      logger.info(`[ConversationMemory] Retrieved context: ${topRelevant.length} relevant conversations`);
      return memoryContext;
    } catch (error) {
      logger.error('[ConversationMemory] Error getting relevant context:', error);
      return {
        recentSummary: '',
        relevantPastContext: [],
        userPreferences: {},
        mentionedEntities: [],
      };
    }
  }

  /**
   * Extract topics/keywords from a message (simple keyword extraction)
   */
  private extractTopics(message: string): string[] {
    // Remove common words and extract meaningful keywords
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
      'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
    ]);

    const words = message.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));

    // Remove duplicates and return
    return [...new Set(words)];
  }

  /**
   * Format memory context for AI prompt
   */
  formatContextForPrompt(memoryContext: MemoryContext): string {
    const parts: string[] = [];

    if (memoryContext.recentSummary) {
      parts.push(`📝 ${memoryContext.recentSummary}`);
    }

    if (memoryContext.relevantPastContext.length > 0) {
      parts.push(`\n🧠 RELEVANT PAST CONVERSATIONS:\n${memoryContext.relevantPastContext.map((ctx, i) => `${i + 1}. ${ctx}`).join('\n')}`);
    }

    if (memoryContext.mentionedEntities.length > 0) {
      parts.push(`\n👥 Previously Mentioned: ${memoryContext.mentionedEntities.slice(0, 10).join(', ')}`);
    }

    if (Object.keys(memoryContext.userPreferences).length > 0) {
      parts.push(`\n⭐ User Preferences:\n${Object.values(memoryContext.userPreferences).join('\n')}`);
    }

    return parts.join('\n');
  }

  /**
   * Archive old conversations (compress and store summary only)
   */
  async archiveOldConversations(userId: string, daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Find old conversations
      const oldConversations = await Conversation.find({
        userId,
        updatedAt: { $lt: cutoffDate },
        'context.archived': { $ne: true },
      });

      let archivedCount = 0;

      for (const conversation of oldConversations) {
        // Summarize if not already summarized
        if (!conversation.context?.summary) {
          await this.summarizeConversation(conversation._id.toString());
        }

        // Keep only first and last 2 messages, plus summary
        const firstTwo = conversation.messages.slice(0, 2);
        const lastTwo = conversation.messages.slice(-2);
        const compressedMessages = [...firstTwo, ...lastTwo];

        // Update conversation
        await Conversation.findByIdAndUpdate(conversation._id, {
          $set: {
            messages: compressedMessages,
            'context.archived': true,
            'context.archivedAt': new Date(),
            'context.originalMessageCount': conversation.messages.length,
          },
        });

        archivedCount++;
      }

      logger.info(`[ConversationMemory] ✅ Archived ${archivedCount} old conversations for user ${userId}`);
      return archivedCount;
    } catch (error) {
      logger.error('[ConversationMemory] Error archiving conversations:', error);
      return 0;
    }
  }

  /**
   * Get user's conversation statistics
   */
  async getUserConversationStats(userId: string): Promise<any> {
    try {
      const [
        totalConversations,
        totalMessages,
        archivedConversations,
        recentConversations,
      ] = await Promise.all([
        Conversation.countDocuments({ userId }),
        Conversation.aggregate([
          { $match: { userId } },
          { $project: { messageCount: { $size: '$messages' } } },
          { $group: { _id: null, total: { $sum: '$messageCount' } } },
        ]),
        Conversation.countDocuments({ userId, 'context.archived': true }),
        Conversation.countDocuments({
          userId,
          updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
      ]);

      // Extract all topics
      const conversationsWithTopics = await Conversation.find({
        userId,
        'context.mainTopics': { $exists: true, $ne: [] },
      }).select('context.mainTopics');

      const allTopics: string[] = [];
      conversationsWithTopics.forEach(conv => {
        if (conv.context?.mainTopics) {
          allTopics.push(...conv.context.mainTopics);
        }
      });

      // Count topic frequency
      const topicFrequency: Record<string, number> = {};
      allTopics.forEach(topic => {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      });

      // Get top topics
      const topTopics = Object.entries(topicFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      return {
        totalConversations,
        totalMessages: totalMessages[0]?.total || 0,
        archivedConversations,
        activeConversations: totalConversations - archivedConversations,
        conversationsLast7Days: recentConversations,
        topTopics,
      };
    } catch (error) {
      logger.error('[ConversationMemory] Error getting conversation stats:', error);
      return null;
    }
  }
}

export default new ConversationMemoryService();
