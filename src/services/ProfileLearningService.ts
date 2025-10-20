import mongoose from 'mongoose';
import UserProfile, { IUserProfile } from '../models/UserProfile';
import Task from '../models/Task';
import Reminder from '../models/Reminder';
import Pattern from '../models/Pattern';
import logger from '../utils/logger';

/**
 * PROFILE LEARNING SERVICE
 *
 * Learns from user behavior and updates UserProfile automatically:
 * - Detects work hours from task completion patterns
 * - Identifies important relationships from frequent mentions
 * - Discovers communication preferences from message length/tone
 * - Builds habit map from recurring activities
 *
 * This runs in the background and continuously improves PA personalization.
 */

class ProfileLearningService {
  /**
   * Get or create user profile
   */
  async getOrCreateProfile(userId: string | mongoose.Types.ObjectId): Promise<IUserProfile> {
    let profile = await UserProfile.findOne({ userId });

    if (!profile) {
      profile = new UserProfile({
        userId,
        communicationStyle: 'balanced',
        responseLength: 'balanced',
        proactivityLevel: 3,
        preferredGreeting: 'Hey Boss!',
      });
      await profile.save();
      logger.info(`[ProfileLearning] Created new profile for user ${userId}`);
    }

    return profile;
  }

  /**
   * Learn work hours from task completion patterns
   */
  async learnWorkHours(userId: string | mongoose.Types.ObjectId): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Get completed tasks from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const completedTasks = await Task.find({
        userId,
        status: 'completed',
        completedAt: { $exists: true, $gte: thirtyDaysAgo },
      }).lean();

      if (completedTasks.length < 20) {
        // Not enough data
        return;
      }

      // Analyze completion times
      const completionHours: number[] = [];
      const completionDays: number[] = [];

      completedTasks.forEach((task: any) => {
        if (task.completedAt) {
          const date = new Date(task.completedAt);
          completionHours.push(date.getHours());
          completionDays.push(date.getDay());
        }
      });

      // Calculate average start/end time
      const sortedHours = completionHours.sort((a, b) => a - b);
      const earliestHour = sortedHours[Math.floor(sortedHours.length * 0.1)]; // 10th percentile
      const latestHour = sortedHours[Math.floor(sortedHours.length * 0.9)]; // 90th percentile

      // Detect work days (days with most activity)
      const dayCount: Record<number, number> = {};
      completionDays.forEach(day => {
        dayCount[day] = (dayCount[day] || 0) + 1;
      });

      const workDays = Object.entries(dayCount)
        .filter(([_, count]) => count >= 3) // At least 3 tasks on this day
        .map(([day, _]) => parseInt(day))
        .sort();

      // Update profile
      profile.workHours = {
        enabled: true,
        start: `${earliestHour.toString().padStart(2, '0')}:00`,
        end: `${latestHour.toString().padStart(2, '0')}:00`,
        timezone: 'UTC', // TODO: Detect from user location
        workDays,
      };

      await profile.save();
      logger.info(`[ProfileLearning] Learned work hours for user ${userId}: ${profile.workHours.start}-${profile.workHours.end}`);
    } catch (error) {
      logger.error('[ProfileLearning] Error learning work hours:', error);
    }
  }

  /**
   * Learn common tasks from recurring patterns
   */
  async learnCommonTasks(userId: string | mongoose.Types.ObjectId): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Get detected patterns
      const patterns = await Pattern.find({
        userId,
        status: 'active',
      }).lean();

      // Add patterns as common tasks
      const newCommonTasks = patterns.map((pattern: any) => ({
        title: pattern.title,
        frequency: pattern.frequency,
        preferredTime: `${pattern.averageHour.toString().padStart(2, '0')}:${pattern.averageMinute.toString().padStart(2, '0')}`,
        priority: 'medium' as 'low' | 'medium' | 'high',
        automationOffered: pattern.automationOffered || false,
        automationAccepted: pattern.automationAccepted || false,
      }));

      // Merge with existing, avoid duplicates
      const existingTitles = new Set(profile.commonTasks.map(t => t.title.toLowerCase()));
      const uniqueNewTasks = newCommonTasks.filter(t => !existingTitles.has(t.title.toLowerCase()));

      if (uniqueNewTasks.length > 0) {
        profile.commonTasks.push(...uniqueNewTasks);
        await profile.save();
        logger.info(`[ProfileLearning] Added ${uniqueNewTasks.length} common tasks for user ${userId}`);
      }
    } catch (error) {
      logger.error('[ProfileLearning] Error learning common tasks:', error);
    }
  }

  /**
   * Learn relationships from conversation mentions
   */
  async learnRelationship(
    userId: string | mongoose.Types.ObjectId,
    personName: string,
    relation: string,
    context?: string
  ): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Check if relationship already exists
      const existing = profile.relationships.find(r => r.name.toLowerCase() === personName.toLowerCase());

      if (!existing) {
        // Add new relationship
        profile.relationships.push({
          name: personName,
          relation: relation as any,
          contactFrequency: 'weekly',
          preferredCommunication: 'call',
          importanceLevel: 3,
          notes: context || '',
        });

        await profile.save();
        logger.info(`[ProfileLearning] Learned relationship: ${personName} (${relation}) for user ${userId}`);
      }
    } catch (error) {
      logger.error('[ProfileLearning] Error learning relationship:', error);
    }
  }

  /**
   * Update communication preferences based on user behavior
   */
  async updateCommunicationPreferences(
    userId: string | mongoose.Types.ObjectId,
    messageLength: number,
    formalityDetected: boolean
  ): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Learn response length preference
      if (messageLength < 50 && profile.responseLength === 'detailed') {
        profile.responseLength = 'balanced';
        await profile.save();
        logger.info(`[ProfileLearning] Updated response length to balanced for user ${userId}`);
      } else if (messageLength > 200 && profile.responseLength === 'brief') {
        profile.responseLength = 'balanced';
        await profile.save();
        logger.info(`[ProfileLearning] Updated response length to balanced for user ${userId}`);
      }

      // Learn formality preference
      if (formalityDetected && profile.communicationStyle === 'casual') {
        profile.communicationStyle = 'balanced';
        await profile.save();
        logger.info(`[ProfileLearning] Updated communication style to balanced for user ${userId}`);
      }
    } catch (error) {
      logger.error('[ProfileLearning] Error updating communication preferences:', error);
    }
  }

  /**
   * Record successful action
   */
  async recordSuccess(userId: string | mongoose.Types.ObjectId): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);
      profile.successfulActions += 1;
      profile.interactionCount += 1;
      await profile.save();
    } catch (error) {
      logger.error('[ProfileLearning] Error recording success:', error);
    }
  }

  /**
   * Record failed action
   */
  async recordFailure(userId: string | mongoose.Types.ObjectId): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);
      profile.failedActions += 1;
      profile.interactionCount += 1;
      await profile.save();
    } catch (error) {
      logger.error('[ProfileLearning] Error recording failure:', error);
    }
  }

  /**
   * Add forbidden topic
   */
  async addForbiddenTopic(userId: string | mongoose.Types.ObjectId, topic: string): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      if (!profile.forbiddenTopics.includes(topic)) {
        profile.forbiddenTopics.push(topic);
        await profile.save();
        logger.info(`[ProfileLearning] Added forbidden topic: ${topic} for user ${userId}`);
      }
    } catch (error) {
      logger.error('[ProfileLearning] Error adding forbidden topic:', error);
    }
  }

  /**
   * Add liked suggestion
   */
  async addLikedSuggestion(userId: string | mongoose.Types.ObjectId, suggestion: string): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      if (!profile.likedSuggestions.includes(suggestion)) {
        profile.likedSuggestions.push(suggestion);
        await profile.save();
      }
    } catch (error) {
      logger.error('[ProfileLearning] Error adding liked suggestion:', error);
    }
  }

  /**
   * Add disliked suggestion
   */
  async addDislikedSuggestion(userId: string | mongoose.Types.ObjectId, suggestion: string): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      if (!profile.dislikedSuggestions.includes(suggestion)) {
        profile.dislikedSuggestions.push(suggestion);
        await profile.save();
      }
    } catch (error) {
      logger.error('[ProfileLearning] Error adding disliked suggestion:', error);
    }
  }

  /**
   * Get user profile summary for AI prompt injection
   */
  async getProfileSummary(userId: string | mongoose.Types.ObjectId): Promise<string> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Update learning score
      profile.learningScore = (profile as any).calculateLearningScore();
      await profile.save();

      return (profile as any).generateAIPromptSummary();
    } catch (error) {
      logger.error('[ProfileLearning] Error getting profile summary:', error);
      return '';
    }
  }

  /**
   * Run full profile learning analysis (background job)
   */
  async runFullAnalysis(userId: string | mongoose.Types.ObjectId): Promise<void> {
    try {
      logger.info(`[ProfileLearning] Running full analysis for user ${userId}`);

      await Promise.all([
        this.learnWorkHours(userId),
        this.learnCommonTasks(userId),
      ]);

      logger.info(`[ProfileLearning] Completed full analysis for user ${userId}`);
    } catch (error) {
      logger.error('[ProfileLearning] Error in full analysis:', error);
    }
  }
}

export default new ProfileLearningService();
