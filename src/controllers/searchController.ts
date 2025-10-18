import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Task, Event, Note, Conversation, Transcript, User } from '../models';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SearchResult {
  id: string;
  type: 'email' | 'meeting' | 'task' | 'note' | 'document';
  title: string;
  content: string;
  source: string;
  date: string;
  relevance: number;
  metadata?: any;
}

interface RecentSearch {
  query: string;
  timestamp: Date;
}

// In-memory storage for recent searches (in production, use Redis or database)
const recentSearchesMap = new Map<string, RecentSearch[]>();

/**
 * Calculate relevance score based on query match
 */
const calculateRelevance = (text: string, query: string): number => {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(' ').filter(w => w.length > 0);

  let score = 0;

  // Exact phrase match gets highest score
  if (lowerText.includes(lowerQuery)) {
    score += 50;
  }

  // Individual word matches
  words.forEach(word => {
    const regex = new RegExp(word, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      score += matches.length * 10;
    }
  });

  // Title match gets bonus
  if (text.length < 100 && lowerText.includes(lowerQuery)) {
    score += 30;
  }

  // Cap at 100
  return Math.min(100, score);
};

/**
 * Format date for display
 */
const formatDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return diffMins === 0 ? 'Just now' : `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

/**
 * Search across all user data
 * @route POST /api/search
 */
export const search = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { query, filter = 'all' } = req.body;

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }

    console.log(`🔍 Search request - User: ${userId}, Query: "${query}", Filter: ${filter}`);

    const results: SearchResult[] = [];
    const searchQuery = query.trim();

    // Search Tasks
    if (filter === 'all' || filter === 'tasks') {
      const tasks = await Task.find({
        userId,
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { tags: { $elemMatch: { $regex: searchQuery, $options: 'i' } } },
        ],
      }).limit(10);

      tasks.forEach(task => {
        const textContent = `${task.title} ${task.description || ''}`;
        const relevance = calculateRelevance(textContent, searchQuery);

        if (relevance > 0) {
          results.push({
            id: String(task._id),
            type: 'task',
            title: task.title,
            content: task.description || 'No description',
            source: 'Tasks',
            date: formatDate(task.updatedAt),
            relevance,
            metadata: {
              priority: task.priority,
              status: task.status,
              dueDate: task.dueDate,
            },
          });
        }
      });
    }

    // Search Events (Meetings)
    if (filter === 'all' || filter === 'meetings') {
      const events = await Event.find({
        userId,
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { location: { $regex: searchQuery, $options: 'i' } },
          { attendees: { $elemMatch: { $regex: searchQuery, $options: 'i' } } },
        ],
      }).limit(10);

      events.forEach(event => {
        const textContent = `${event.title} ${event.description || ''} ${event.location || ''}`;
        const relevance = calculateRelevance(textContent, searchQuery);

        if (relevance > 0) {
          results.push({
            id: String(event._id),
            type: 'meeting',
            title: event.title,
            content: event.description || `Meeting at ${event.location || 'No location'}`,
            source: 'Meeting Notes',
            date: formatDate(event.startTime),
            relevance,
            metadata: {
              startTime: event.startTime,
              endTime: event.endTime,
              location: event.location,
              attendees: event.attendees,
            },
          });
        }
      });
    }

    // Search Notes
    if (filter === 'all' || filter === 'notes') {
      const notes = await Note.find({
        userId,
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { content: { $regex: searchQuery, $options: 'i' } },
          { tags: { $elemMatch: { $regex: searchQuery, $options: 'i' } } },
        ],
      }).limit(10);

      notes.forEach(note => {
        const textContent = `${note.title} ${note.content}`;
        const relevance = calculateRelevance(textContent, searchQuery);

        if (relevance > 0) {
          results.push({
            id: String(note._id),
            type: 'note',
            title: note.title,
            content: note.content.substring(0, 150) + (note.content.length > 150 ? '...' : ''),
            source: 'Quick Notes',
            date: formatDate(note.updatedAt),
            relevance,
            metadata: {
              category: note.category,
              wordCount: note.wordCount,
            },
          });
        }
      });
    }

    // Search Transcripts (Documents/Recordings)
    if (filter === 'all' || filter === 'documents') {
      const transcripts = await Transcript.find({
        userId,
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { content: { $regex: searchQuery, $options: 'i' } },
          { actionItems: { $elemMatch: { $regex: searchQuery, $options: 'i' } } },
        ],
      }).limit(10);

      transcripts.forEach(transcript => {
        const textContent = `${transcript.title} ${transcript.content}`;
        const relevance = calculateRelevance(textContent, searchQuery);

        if (relevance > 0) {
          results.push({
            id: String(transcript._id),
            type: 'document',
            title: transcript.title,
            content: transcript.content.substring(0, 150) + (transcript.content.length > 150 ? '...' : ''),
            source: 'Recordings',
            date: formatDate(transcript.recordedAt),
            relevance,
            metadata: {
              duration: transcript.duration,
              participants: transcript.participants,
            },
          });
        }
      });
    }

    // Search Conversations (Emails/Messages)
    if (filter === 'all' || filter === 'emails') {
      const conversations = await Conversation.find({
        userId,
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { 'messages.content': { $regex: searchQuery, $options: 'i' } },
        ],
      }).limit(10);

      conversations.forEach(conv => {
        const lastMessage = conv.messages[conv.messages.length - 1];
        const textContent = `${conv.title || ''} ${lastMessage?.content || ''}`;
        const relevance = calculateRelevance(textContent, searchQuery);

        if (relevance > 0) {
          results.push({
            id: String(conv._id),
            type: 'email',
            title: conv.title || 'Untitled Conversation',
            content: lastMessage?.content.substring(0, 150) + (lastMessage?.content.length > 150 ? '...' : '') || 'No messages',
            source: 'Conversations',
            date: formatDate(conv.updatedAt),
            relevance,
            metadata: {
              messageCount: conv.messages.length,
            },
          });
        }
      });
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    // Store recent search
    const userSearches = recentSearchesMap.get(userId) || [];
    userSearches.unshift({ query: searchQuery, timestamp: new Date() });
    // Keep only last 10 searches
    if (userSearches.length > 10) {
      userSearches.pop();
    }
    recentSearchesMap.set(userId, userSearches);

    console.log(`✅ Search completed - Found ${results.length} results`);

    res.json({
      success: true,
      data: {
        results,
        totalResults: results.length,
        query: searchQuery,
        filter,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform search',
    });
  }
};

/**
 * Get AI-generated summary for search results
 * @route POST /api/search/ai-summary
 */
export const getAiSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { query, results } = req.body;

    console.log(`🤖 Generating AI summary for query: "${query}"`);

    let summary = '';
    let suggestions: string[] = [];

    if (results.length === 0) {
      summary = `I couldn't find any results for "${query}". Try using different keywords or check your filters.`;
      suggestions = [
        'Try broader search terms',
        'Check your filter settings',
        'Search in all categories',
      ];
    } else {
      // Use OpenAI to generate intelligent summary
      try {
        // Prepare context from search results
        const resultsContext = results.slice(0, 5).map((r: SearchResult) => ({
          type: r.type,
          title: r.title,
          content: r.content.substring(0, 200),
          relevance: r.relevance,
        }));

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant that summarizes search results. Be concise, insightful, and actionable. Focus on key patterns and insights across the results.',
            },
            {
              role: 'user',
              content: `User searched for: "${query}"\n\nFound ${results.length} results:\n${JSON.stringify(resultsContext, null, 2)}\n\nProvide a 2-3 sentence summary highlighting the key findings and any patterns you notice. Be conversational and helpful.`,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        });

        summary = completion.choices[0]?.message?.content ||
          `Found ${results.length} results related to "${query}" across your data.`;

        // Generate contextual action suggestions
        const suggestionsCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Generate 3 short, actionable suggestions (4-6 words each) based on search results. Make them specific and helpful.',
            },
            {
              role: 'user',
              content: `Query: "${query}"\nResults types: ${results.map((r: SearchResult) => r.type).join(', ')}\n\nGenerate 3 action suggestions.`,
            },
          ],
          max_tokens: 100,
          temperature: 0.8,
        });

        const suggestionsText = suggestionsCompletion.choices[0]?.message?.content || '';
        suggestions = suggestionsText
          .split('\n')
          .filter(s => s.trim().length > 0)
          .map(s => s.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
          .slice(0, 3);

        if (suggestions.length === 0) {
          suggestions = [
            'Create a summary document',
            'Generate action items',
            'Create follow-up tasks',
          ];
        }
      } catch (aiError) {
        console.error('OpenAI API error:', aiError);
        // Fallback to simple summary
        const resultTypes = new Set(results.map((r: SearchResult) => r.type));
        const typeNames: Record<string, string> = {
          email: 'conversations',
          meeting: 'meetings',
          task: 'tasks',
          note: 'notes',
          document: 'recordings',
        };
        const foundTypes = Array.from(resultTypes).map(t => typeNames[t as string] || t);
        summary = `Found ${results.length} results for "${query}" across your ${foundTypes.join(', ')}.`;
        suggestions = [
          'Create a summary document',
          'Generate action items',
          'Create follow-up tasks',
        ];
      }
    }

    res.json({
      success: true,
      data: {
        summary,
        suggestions,
      },
    });
  } catch (error) {
    console.error('AI summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI summary',
    });
  }
};

/**
 * Get recent searches for user
 * @route GET /api/search/recent
 */
export const getRecentSearches = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const userSearches = recentSearchesMap.get(userId) || [];

    res.json({
      success: true,
      data: {
        searches: userSearches.map(s => s.query),
      },
    });
  } catch (error) {
    console.error('Get recent searches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent searches',
    });
  }
};

/**
 * Get AI-powered search suggestions
 * @route GET /api/search/suggestions
 */
export const getSuggestions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await User.findById(userId);

    let suggestions: string[] = [];

    try {
      // Get recent user activity to personalize suggestions
      const [recentTasks, recentEvents, recentNotes] = await Promise.all([
        Task.find({ userId }).sort({ updatedAt: -1 }).limit(3),
        Event.find({ userId }).sort({ updatedAt: -1 }).limit(3),
        Note.find({ userId }).sort({ updatedAt: -1 }).limit(3),
      ]);

      // Build context for AI
      const activityContext = {
        userName: user?.firstName || 'User',
        recentTasks: recentTasks.map(t => ({ title: t.title, priority: t.priority, status: t.status })),
        recentEvents: recentEvents.map(e => ({ title: e.title, date: e.startTime })),
        recentNotes: recentNotes.map(n => ({ title: n.title, category: n.category })),
      };

      // Use OpenAI to generate personalized suggestions
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant that suggests relevant search queries based on user activity. Generate 5 specific, actionable search suggestions that would be useful for this user. Each suggestion should be a natural search query (6-10 words). Make them diverse and cover different aspects of their work.',
          },
          {
            role: 'user',
            content: `User activity context:\n${JSON.stringify(activityContext, null, 2)}\n\nGenerate 5 personalized search suggestions that would be helpful for this user.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      const suggestionsText = completion.choices[0]?.message?.content || '';
      suggestions = suggestionsText
        .split('\n')
        .filter(s => s.trim().length > 0)
        .map(s => s.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
        .slice(0, 5);

      // Fallback if AI didn't generate enough suggestions
      if (suggestions.length < 5) {
        const fallbackSuggestions = [
          'Show me tasks due this week',
          'Find meetings scheduled for today',
          'Recent notes about projects',
          'Recordings from the last 7 days',
          'Conversations with action items',
        ];
        suggestions = [...suggestions, ...fallbackSuggestions].slice(0, 5);
      }
    } catch (aiError) {
      console.error('OpenAI API error for suggestions:', aiError);
      // Fallback to static suggestions
      suggestions = [
        'Show me tasks due this week',
        'Find meetings scheduled for today',
        'Recent notes about projects',
        'Recordings from the last 7 days',
        'Conversations with action items',
      ];
    }

    res.json({
      success: true,
      data: {
        suggestions,
      },
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions',
    });
  }
};

/**
 * Clear recent searches
 * @route DELETE /api/search/recent
 */
export const clearRecentSearches = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    recentSearchesMap.delete(userId);

    res.json({
      success: true,
      message: 'Recent searches cleared',
    });
  } catch (error) {
    console.error('Clear recent searches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear recent searches',
    });
  }
};
