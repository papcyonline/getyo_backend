/**
 * PA MEMORY SERVICE
 *
 * Implements advanced memory and context management for the PA.
 * Allows the PA to remember user preferences, learn from interactions,
 * and maintain long-term context across conversations.
 *
 * Memory Types:
 * 1. Short-term: Current conversation context
 * 2. Working memory: Active tasks and ongoing actions
 * 3. Long-term: User preferences, patterns, learned behavior
 * 4. Episodic: Past conversations and interactions
 * 5. Semantic: Factual knowledge about user
 */

interface MemoryEntry {
  id: string;
  userId: string;
  type: 'preference' | 'pattern' | 'fact' | 'interaction' | 'feedback';
  category: string;
  content: string;
  confidence: number; // 0-1 scale
  importance: number; // 0-1 scale
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  expiresAt?: Date;
  metadata?: any;
}

interface UserPreference {
  key: string;
  value: any;
  confidence: number;
  learnedFrom: 'explicit' | 'implicit';
  lastUpdated: Date;
}

interface ConversationContext {
  userId: string;
  conversationId: string;
  activeTopics: string[];
  mentionedEntities: Map<string, any>;
  pendingActions: any[];
  userMood?: 'positive' | 'neutral' | 'negative' | 'urgent';
  conversationPhase: 'greeting' | 'task' | 'clarification' | 'closing';
}

class PAMemoryService {
  // In-memory cache (in production, use Redis or similar)
  private memoryCache: Map<string, MemoryEntry[]> = new Map();
  private contextCache: Map<string, ConversationContext> = new Map();
  private preferenceCache: Map<string, UserPreference[]> = new Map();

  /**
   * ============================================================
   * PREFERENCE LEARNING
   * ============================================================
   */

  /**
   * Learn user preferences from interactions
   */
  async learnPreference(
    userId: string,
    key: string,
    value: any,
    learnedFrom: 'explicit' | 'implicit' = 'explicit',
    confidence: number = 1.0
  ): Promise<void> {
    const preferences = this.preferenceCache.get(userId) || [];

    const existingIndex = preferences.findIndex(p => p.key === key);

    if (existingIndex >= 0) {
      // Update existing preference
      preferences[existingIndex] = {
        key,
        value,
        confidence: Math.max(preferences[existingIndex].confidence, confidence),
        learnedFrom,
        lastUpdated: new Date(),
      };
    } else {
      // Add new preference
      preferences.push({
        key,
        value,
        confidence,
        learnedFrom,
        lastUpdated: new Date(),
      });
    }

    this.preferenceCache.set(userId, preferences);

    console.log(`🧠 Learned preference for ${userId}: ${key} = ${value} (${learnedFrom}, confidence: ${confidence})`);

    // Persist to database
    await this.saveMemoryToDB({
      id: `pref_${userId}_${key}_${Date.now()}`,
      userId,
      type: 'preference',
      category: key,
      content: JSON.stringify(value),
      confidence,
      importance: 0.7,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      metadata: { learnedFrom },
    });
  }

  /**
   * Get user preference
   */
  async getPreference(userId: string, key: string, defaultValue?: any): Promise<any> {
    const preferences = this.preferenceCache.get(userId) || [];
    const preference = preferences.find(p => p.key === key);

    if (preference) {
      console.log(`🔍 Retrieved preference: ${key} = ${preference.value}`);
      return preference.value;
    }

    // Try loading from database if not in cache
    const dbPreferences = await this.loadPreferencesFromDB(userId);
    const dbPreference = dbPreferences.find(p => p.key === key);

    if (dbPreference) {
      return dbPreference.value;
    }

    return defaultValue;
  }

  /**
   * Detect patterns in user behavior
   */
  async detectPatterns(userId: string): Promise<string[]> {
    const patterns: string[] = [];

    // Load user's task history
    const Task = (await import('../models/Task')).default;
    const tasks = await Task.find({ userId }).sort({ createdAt: -1 }).limit(100);

    // Pattern: Recurring tasks
    const taskTitles = tasks.map(t => t.title.toLowerCase());
    const taskCounts = new Map<string, number>();

    taskTitles.forEach(title => {
      const count = taskCounts.get(title) || 0;
      taskCounts.set(title, count + 1);
    });

    // Find recurring tasks (appears 3+ times)
    for (const [title, count] of taskCounts) {
      if (count >= 3) {
        patterns.push(`recurring_task:${title}`);
        await this.learnPreference(
          userId,
          `recurring_task_${title}`,
          { title, frequency: count },
          'implicit',
          0.8
        );
      }
    }

    // Pattern: Preferred task creation time
    const createHours = tasks.map(t => new Date(t.createdAt).getHours());
    const avgCreateHour = createHours.reduce((a, b) => a + b, 0) / createHours.length;

    if (createHours.length > 10) {
      const preferredHour = Math.round(avgCreateHour);
      patterns.push(`preferred_task_time:${preferredHour}:00`);
      await this.learnPreference(
        userId,
        'preferred_task_creation_time',
        { hour: preferredHour },
        'implicit',
        0.6
      );
    }

    // Pattern: Task completion rate
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const completionRate = completedTasks / tasks.length;

    if (completionRate > 0.8) {
      patterns.push('high_completion_rate');
    } else if (completionRate < 0.3) {
      patterns.push('low_completion_rate');
    }

    console.log(`📊 Detected ${patterns.length} patterns for user ${userId}`);
    return patterns;
  }

  /**
   * ============================================================
   * CONVERSATION CONTEXT MANAGEMENT
   * ============================================================
   */

  /**
   * Initialize conversation context
   */
  initializeContext(userId: string, conversationId: string): ConversationContext {
    const context: ConversationContext = {
      userId,
      conversationId,
      activeTopics: [],
      mentionedEntities: new Map(),
      pendingActions: [],
      conversationPhase: 'greeting',
    };

    this.contextCache.set(conversationId, context);
    return context;
  }

  /**
   * Update conversation context
   */
  updateContext(conversationId: string, updates: Partial<ConversationContext>): void {
    const context = this.contextCache.get(conversationId);

    if (context) {
      Object.assign(context, updates);
      this.contextCache.set(conversationId, context);
      console.log(`🔄 Updated context for conversation ${conversationId}`);
    }
  }

  /**
   * Add topic to active conversation
   */
  addTopic(conversationId: string, topic: string): void {
    const context = this.contextCache.get(conversationId);

    if (context) {
      if (!context.activeTopics.includes(topic)) {
        context.activeTopics.push(topic);
        console.log(`📌 Added topic "${topic}" to conversation`);
      }
    }
  }

  /**
   * Add entity mention (person, place, thing)
   */
  addEntity(conversationId: string, entityType: string, entityValue: any): void {
    const context = this.contextCache.get(conversationId);

    if (context) {
      context.mentionedEntities.set(entityType, entityValue);
      console.log(`📌 Added entity: ${entityType} = ${JSON.stringify(entityValue)}`);
    }
  }

  /**
   * Get conversation context
   */
  getContext(conversationId: string): ConversationContext | undefined {
    return this.contextCache.get(conversationId);
  }

  /**
   * Detect user mood from message
   */
  detectMood(message: string): 'positive' | 'neutral' | 'negative' | 'urgent' {
    const lowerMessage = message.toLowerCase();

    // Urgent indicators
    const urgentWords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'now', 'help!'];
    if (urgentWords.some(word => lowerMessage.includes(word))) {
      return 'urgent';
    }

    // Positive indicators
    const positiveWords = ['thank', 'great', 'awesome', 'perfect', 'excellent', 'love', 'happy', '!', '😊'];
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;

    // Negative indicators
    const negativeWords = ['frustrated', 'annoyed', 'disappointed', 'wrong', 'broken', 'issue', 'problem', 'fail'];
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;

    if (positiveCount > negativeCount && positiveCount >= 2) {
      return 'positive';
    }

    if (negativeCount > positiveCount && negativeCount >= 2) {
      return 'negative';
    }

    return 'neutral';
  }

  /**
   * ============================================================
   * MEMORY STORAGE & RETRIEVAL
   * ============================================================
   */

  /**
   * Store a memory
   */
  async rememberFact(
    userId: string,
    category: string,
    content: string,
    importance: number = 0.5
  ): Promise<void> {
    const memory: MemoryEntry = {
      id: `fact_${userId}_${Date.now()}`,
      userId,
      type: 'fact',
      category,
      content,
      confidence: 1.0,
      importance,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
    };

    // Add to cache
    const userMemories = this.memoryCache.get(userId) || [];
    userMemories.push(memory);
    this.memoryCache.set(userId, userMemories);

    // Persist to database
    await this.saveMemoryToDB(memory);

    console.log(`💾 Remembered: ${category} - ${content}`);
  }

  /**
   * Recall memories by category
   */
  async recallMemories(userId: string, category: string, limit: number = 10): Promise<MemoryEntry[]> {
    const userMemories = this.memoryCache.get(userId) || [];

    const relevantMemories = userMemories
      .filter(m => m.category === category)
      .sort((a, b) => {
        // Sort by importance * recency * access count
        const scoreA = a.importance * (1 / ((Date.now() - a.createdAt.getTime()) / 86400000 + 1)) * (a.accessCount + 1);
        const scoreB = b.importance * (1 / ((Date.now() - b.createdAt.getTime()) / 86400000 + 1)) * (b.accessCount + 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    // Update access counts
    relevantMemories.forEach(m => {
      m.lastAccessed = new Date();
      m.accessCount++;
    });

    console.log(`🔍 Recalled ${relevantMemories.length} memories for category: ${category}`);
    return relevantMemories;
  }

  /**
   * Search memories by content
   */
  async searchMemories(userId: string, query: string, limit: number = 5): Promise<MemoryEntry[]> {
    const userMemories = this.memoryCache.get(userId) || [];
    const lowerQuery = query.toLowerCase();

    const matches = userMemories
      .filter(m => m.content.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);

    console.log(`🔍 Found ${matches.length} memories matching: "${query}"`);
    return matches;
  }

  /**
   * ============================================================
   * LEARNING FROM FEEDBACK
   * ============================================================
   */

  /**
   * Record user feedback on PA response
   */
  async recordFeedback(
    userId: string,
    conversationId: string,
    messageId: string,
    feedbackType: 'positive' | 'negative' | 'correction',
    details?: string
  ): Promise<void> {
    const feedback: MemoryEntry = {
      id: `feedback_${userId}_${Date.now()}`,
      userId,
      type: 'feedback',
      category: feedbackType,
      content: details || '',
      confidence: 1.0,
      importance: 0.9, // Feedback is very important for learning
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      metadata: {
        conversationId,
        messageId,
        feedbackType,
      },
    };

    await this.saveMemoryToDB(feedback);
    console.log(`📝 Recorded ${feedbackType} feedback for conversation ${conversationId}`);

    // Adjust confidence in related memories if negative feedback
    if (feedbackType === 'negative') {
      // Find and reduce confidence in memories from this conversation
      const userMemories = this.memoryCache.get(userId) || [];
      userMemories
        .filter(m => m.metadata?.conversationId === conversationId)
        .forEach(m => {
          m.confidence = Math.max(0.3, m.confidence - 0.2);
        });
    }
  }

  /**
   * ============================================================
   * MEMORY CONSOLIDATION & CLEANUP
   * ============================================================
   */

  /**
   * Consolidate memories (run periodically)
   */
  async consolidateMemories(userId: string): Promise<void> {
    const userMemories = this.memoryCache.get(userId) || [];

    // Remove low-importance, old, unaccessed memories
    const now = Date.now();
    const retainedMemories = userMemories.filter(m => {
      const ageInDays = (now - m.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const score = m.importance * m.confidence * (m.accessCount + 1) / (ageInDays + 1);
      return score > 0.1; // Threshold for retention
    });

    const removed = userMemories.length - retainedMemories.length;
    this.memoryCache.set(userId, retainedMemories);

    console.log(`🧹 Consolidated memories for ${userId}: removed ${removed} low-value memories`);

    // Merge similar memories
    // TODO: Implement similarity detection and merging
  }

  /**
   * ============================================================
   * CONTEXT GENERATION FOR AI
   * ============================================================
   */

  /**
   * Generate enhanced context for AI
   */
  async generateEnhancedContext(userId: string, conversationId: string): Promise<string> {
    // Get conversation context
    const context = this.getContext(conversationId);

    // Get user preferences
    const preferences = this.preferenceCache.get(userId) || [];

    // Get recent memories
    const recentMemories = await this.recallMemories(userId, 'interaction', 5);

    // Get patterns
    const patterns = await this.detectPatterns(userId);

    // Build context string
    let contextString = `ENHANCED CONTEXT FOR CONVERSATION:\n\n`;

    if (context) {
      contextString += `CONVERSATION STATE:\n`;
      contextString += `- Phase: ${context.conversationPhase}\n`;
      contextString += `- Active Topics: ${context.activeTopics.join(', ')}\n`;
      contextString += `- User Mood: ${context.userMood || 'unknown'}\n`;

      if (context.mentionedEntities.size > 0) {
        contextString += `- Mentioned Entities:\n`;
        context.mentionedEntities.forEach((value, key) => {
          contextString += `  * ${key}: ${JSON.stringify(value)}\n`;
        });
      }

      if (context.pendingActions.length > 0) {
        contextString += `- Pending Actions: ${context.pendingActions.length}\n`;
      }
    }

    if (preferences.length > 0) {
      contextString += `\nUSER PREFERENCES:\n`;
      preferences.forEach(pref => {
        contextString += `- ${pref.key}: ${pref.value} (confidence: ${(pref.confidence * 100).toFixed(0)}%)\n`;
      });
    }

    if (patterns.length > 0) {
      contextString += `\nDETECTED PATTERNS:\n`;
      patterns.forEach(pattern => {
        contextString += `- ${pattern}\n`;
      });
    }

    if (recentMemories.length > 0) {
      contextString += `\nRECENT INTERACTIONS:\n`;
      recentMemories.forEach(memory => {
        contextString += `- ${memory.category}: ${memory.content}\n`;
      });
    }

    return contextString;
  }

  /**
   * ============================================================
   * DATABASE PERSISTENCE
   * ============================================================
   */

  private async saveMemoryToDB(memory: MemoryEntry): Promise<void> {
    // In production, save to MongoDB
    // For now, just log
    console.log(`💾 [DB] Saving memory: ${memory.type} - ${memory.category}`);
  }

  private async loadPreferencesFromDB(userId: string): Promise<UserPreference[]> {
    // In production, load from MongoDB
    // For now, return empty
    return [];
  }
}

export default new PAMemoryService();
