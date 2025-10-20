import Pattern, { IPattern } from '../models/Pattern';
import User from '../models/User';
import Notification from '../models/Notification';
import mongoose from 'mongoose';
import logger from '../utils/logger';

// Import models we'll analyze for patterns
// Assuming these exist based on your codebase
import Task from '../models/Task';
import Reminder from '../models/Reminder';

interface PatternCandidate {
  title: string;
  type: 'reminder' | 'task' | 'call' | 'activity';
  occurrences: Array<{
    date: Date;
    id: mongoose.Types.ObjectId;
  }>;
  averageHour: number;
  averageMinute: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  dayOfWeek?: number;
  customDays?: number[];
  consistency: number;
}

interface ForgottenActivity {
  pattern: IPattern;
  user: any;
  minutesLate: number;
  gracePeriodMinutes: number;
}

class PAPatternDetectionService {
  /**
   * Detect patterns for a specific user
   * Analyzes last 60 days of tasks and reminders
   */
  async detectPatternsForUser(userId: string | mongoose.Types.ObjectId): Promise<IPattern[]> {
    try {
      logger.info(`[PatternDetection] Starting pattern detection for user ${userId}`);

      // Get user's activities from last 60 days
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Fetch reminders and tasks
      const [reminders, tasks] = await Promise.all([
        Reminder.find({
          userId,
          createdAt: { $gte: sixtyDaysAgo },
        }).lean(),
        Task.find({
          userId,
          createdAt: { $gte: sixtyDaysAgo },
        }).lean(),
      ]);

      logger.info(`[PatternDetection] Found ${reminders.length} reminders and ${tasks.length} tasks for user ${userId}`);

      // Combine all activities
      const activities = [
        ...reminders.map((r: any) => ({
          title: r.title,
          type: 'reminder' as const,
          date: r.reminderTime || r.createdAt,
          id: r._id,
        })),
        ...tasks.map((t: any) => ({
          title: t.title,
          type: 'task' as const,
          date: t.dueDate || t.createdAt,
          id: t._id,
        })),
      ];

      // Group activities by similar titles
      const groupedActivities = this.groupSimilarActivities(activities);

      logger.info(`[PatternDetection] Grouped into ${groupedActivities.size} unique activity types`);

      // Analyze each group for patterns
      const patternCandidates: PatternCandidate[] = [];

      for (const [normalizedTitle, occurrences] of groupedActivities.entries()) {
        // Need at least 5 occurrences to detect a pattern
        if (occurrences.length >= 5) {
          const pattern = this.analyzeActivityGroup(normalizedTitle, occurrences);
          if (pattern) {
            patternCandidates.push(pattern);
          }
        }
      }

      logger.info(`[PatternDetection] Found ${patternCandidates.length} pattern candidates`);

      // Save or update patterns in database
      const savedPatterns: IPattern[] = [];

      for (const candidate of patternCandidates) {
        const pattern = await this.saveOrUpdatePattern(userId, candidate);
        if (pattern) {
          savedPatterns.push(pattern);
        }
      }

      logger.info(`[PatternDetection] Saved/updated ${savedPatterns.length} patterns for user ${userId}`);

      return savedPatterns;
    } catch (error) {
      logger.error('[PatternDetection] Error detecting patterns:', error);
      throw error;
    }
  }

  /**
   * Group activities by similar titles (normalized)
   */
  private groupSimilarActivities(
    activities: Array<{ title: string; type: string; date: Date; id: mongoose.Types.ObjectId }>
  ): Map<string, Array<{ date: Date; id: mongoose.Types.ObjectId; type: string }>> {
    const groups = new Map<string, Array<{ date: Date; id: mongoose.Types.ObjectId; type: string }>>();

    for (const activity of activities) {
      const normalized = this.normalizeTitle(activity.title);

      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }

      groups.get(normalized)!.push({
        date: activity.date,
        id: activity.id,
        type: activity.type,
      });
    }

    return groups;
  }

  /**
   * Normalize activity title for comparison
   * "Drink water", "drink water!", "Drinking water" -> "drink water"
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[!?.,:;]/g, '') // Remove punctuation
      .replace(/ing\s/g, ' ') // "drinking water" -> "drink water"
      .replace(/\s+/g, ' '); // Multiple spaces -> single space
  }

  /**
   * Analyze a group of activities to detect pattern
   */
  private analyzeActivityGroup(
    title: string,
    occurrences: Array<{ date: Date; id: mongoose.Types.ObjectId; type: string }>
  ): PatternCandidate | null {
    // Sort by date
    occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate average time of day
    let totalMinutes = 0;
    const hours: number[] = [];
    const minutes: number[] = [];
    const daysOfWeek: number[] = [];

    for (const occurrence of occurrences) {
      const hour = occurrence.date.getHours();
      const minute = occurrence.date.getMinutes();
      const dayOfWeek = occurrence.date.getDay(); // 0-6

      hours.push(hour);
      minutes.push(minute);
      daysOfWeek.push(dayOfWeek);

      totalMinutes += hour * 60 + minute;
    }

    const averageMinutesOfDay = Math.round(totalMinutes / occurrences.length);
    const averageHour = Math.floor(averageMinutesOfDay / 60);
    const averageMinute = averageMinutesOfDay % 60;

    // Detect frequency pattern
    const frequency = this.detectFrequencyPattern(occurrences, daysOfWeek);

    if (!frequency) {
      return null; // No clear pattern
    }

    // Calculate consistency
    const consistency = this.calculateConsistency(occurrences, frequency);

    // Need at least 60% consistency to be a valid pattern
    if (consistency < 0.6) {
      return null;
    }

    const candidate: PatternCandidate = {
      title,
      type: occurrences[0].type as any,
      occurrences: occurrences.map(o => ({ date: o.date, id: o.id })),
      averageHour,
      averageMinute,
      frequency: frequency.type,
      dayOfWeek: frequency.dayOfWeek,
      customDays: frequency.customDays,
      consistency,
    };

    return candidate;
  }

  /**
   * Detect if activities follow a daily, weekly, or monthly pattern
   */
  private detectFrequencyPattern(
    occurrences: Array<{ date: Date }>,
    daysOfWeek: number[]
  ): { type: 'daily' | 'weekly' | 'monthly' | 'custom'; dayOfWeek?: number; customDays?: number[] } | null {
    const intervals: number[] = [];

    // Calculate intervals between occurrences (in days)
    for (let i = 1; i < occurrences.length; i++) {
      const daysDiff = Math.round(
        (occurrences[i].date.getTime() - occurrences[i - 1].date.getTime()) / (1000 * 60 * 60 * 24)
      );
      intervals.push(daysDiff);
    }

    const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Daily pattern: average interval ~1 day (allow ±0.5 days)
    if (averageInterval >= 0.5 && averageInterval <= 1.5) {
      return { type: 'daily' };
    }

    // Weekly pattern: average interval ~7 days
    if (averageInterval >= 6 && averageInterval <= 8) {
      // Find most common day of week
      const dayFrequency = this.getMostFrequentValue(daysOfWeek);
      return { type: 'weekly', dayOfWeek: dayFrequency.value };
    }

    // Custom pattern: e.g., 3 times a week (Mon/Wed/Fri)
    if (averageInterval >= 2 && averageInterval <= 4) {
      const uniqueDays = [...new Set(daysOfWeek)];
      if (uniqueDays.length >= 2 && uniqueDays.length <= 5) {
        return { type: 'custom', customDays: uniqueDays };
      }
    }

    // Monthly pattern: average interval ~30 days
    if (averageInterval >= 25 && averageInterval <= 35) {
      return { type: 'monthly' };
    }

    return null;
  }

  /**
   * Calculate pattern consistency (0-1)
   * How reliably does this pattern occur?
   */
  private calculateConsistency(
    occurrences: Array<{ date: Date }>,
    frequency: { type: string; dayOfWeek?: number; customDays?: number[] }
  ): number {
    if (occurrences.length < 2) return 0;

    const firstDate = occurrences[0].date;
    const lastDate = occurrences[occurrences.length - 1].date;
    const daysDiff = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    let expectedOccurrences = 0;

    if (frequency.type === 'daily') {
      expectedOccurrences = daysDiff;
    } else if (frequency.type === 'weekly') {
      expectedOccurrences = Math.floor(daysDiff / 7);
    } else if (frequency.type === 'monthly') {
      expectedOccurrences = Math.floor(daysDiff / 30);
    } else if (frequency.type === 'custom' && frequency.customDays) {
      // For custom (e.g., 3 days a week)
      expectedOccurrences = Math.floor((daysDiff / 7) * frequency.customDays.length);
    }

    if (expectedOccurrences === 0) return 0;

    return Math.min(occurrences.length / expectedOccurrences, 1);
  }

  /**
   * Get most frequent value in array
   */
  private getMostFrequentValue(arr: number[]): { value: number; frequency: number } {
    const frequency: Record<number, number> = {};

    for (const val of arr) {
      frequency[val] = (frequency[val] || 0) + 1;
    }

    let maxFreq = 0;
    let mostFrequent = arr[0];

    for (const [val, freq] of Object.entries(frequency)) {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostFrequent = parseInt(val);
      }
    }

    return { value: mostFrequent, frequency: maxFreq };
  }

  /**
   * Save or update pattern in database
   */
  private async saveOrUpdatePattern(
    userId: string | mongoose.Types.ObjectId,
    candidate: PatternCandidate
  ): Promise<IPattern | null> {
    try {
      // Check if pattern already exists
      const existingPattern = await Pattern.findOne({
        userId,
        title: candidate.title,
        frequency: candidate.frequency,
      });

      if (existingPattern) {
        // Update existing pattern
        existingPattern.occurrences = candidate.occurrences.length;
        existingPattern.consistency = candidate.consistency;
        existingPattern.lastOccurrence = candidate.occurrences[candidate.occurrences.length - 1].date;
        existingPattern.timing.hour = candidate.averageHour;
        existingPattern.timing.minute = candidate.averageMinute;

        if (candidate.dayOfWeek !== undefined) {
          existingPattern.timing.dayOfWeek = candidate.dayOfWeek;
        }
        if (candidate.customDays) {
          existingPattern.timing.customDays = candidate.customDays;
        }

        existingPattern.metadata.originalTaskIds = candidate.occurrences.map(o => o.id);

        await existingPattern.save();

        logger.info(`[PatternDetection] Updated existing pattern: ${candidate.title} for user ${userId}`);

        // If pattern is strong and user hasn't responded, offer automation
        if (
          existingPattern.consistency >= 0.7 &&
          existingPattern.userResponse === 'pending' &&
          !existingPattern.metadata.automationOfferedAt
        ) {
          await this.offerAutomation(userId, existingPattern);
        }

        return existingPattern;
      } else {
        // Create new pattern
        const priority = this.determinePriority(candidate.title);

        const newPattern = new Pattern({
          userId,
          type: candidate.type,
          title: candidate.title,
          frequency: candidate.frequency,
          timing: {
            hour: candidate.averageHour,
            minute: candidate.averageMinute,
            dayOfWeek: candidate.dayOfWeek,
            customDays: candidate.customDays,
          },
          occurrences: candidate.occurrences.length,
          consistency: candidate.consistency,
          lastOccurrence: candidate.occurrences[candidate.occurrences.length - 1].date,
          firstDetected: new Date(),
          priority,
          metadata: {
            originalTaskIds: candidate.occurrences.map(o => o.id),
          },
        });

        await newPattern.save();

        logger.info(`[PatternDetection] Created new pattern: ${candidate.title} for user ${userId}`);

        // Offer automation if pattern is strong enough
        if (newPattern.consistency >= 0.7) {
          await this.offerAutomation(userId, newPattern);
        }

        return newPattern;
      }
    } catch (error) {
      logger.error('[PatternDetection] Error saving pattern:', error);
      return null;
    }
  }

  /**
   * Determine pattern priority based on title keywords
   */
  private determinePriority(title: string): 'critical' | 'high' | 'medium' | 'low' {
    const titleLower = title.toLowerCase();

    // Critical patterns (health, medication, bills)
    const criticalKeywords = ['medication', 'medicine', 'pill', 'insulin', 'bill', 'payment', 'rent', 'mortgage'];
    if (criticalKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'critical';
    }

    // High priority (health, work, family)
    const highKeywords = ['call wife', 'call mom', 'call dad', 'exercise', 'gym', 'workout', 'meeting', 'deadline'];
    if (highKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'high';
    }

    // Low priority (breaks, optional activities)
    const lowKeywords = ['coffee', 'tea', 'break', 'snack'];
    if (lowKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'low';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Offer automation to user via notification
   */
  private async offerAutomation(userId: string | mongoose.Types.ObjectId, pattern: IPattern): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const assistantName = user.assistantName || 'Yo';

      // Create friendly automation offer message
      const frequencyText =
        pattern.frequency === 'daily'
          ? 'every day'
          : pattern.frequency === 'weekly'
          ? `every ${this.getDayName(pattern.timing.dayOfWeek!)}`
          : pattern.frequency === 'custom' && pattern.timing.customDays
          ? this.getCustomDaysText(pattern.timing.customDays)
          : 'every month';

      const timeText = `${pattern.timing.hour}:${pattern.timing.minute.toString().padStart(2, '0')}`;

      const message = `Hey Boss! I've noticed you set a reminder to "${pattern.title}" ${frequencyText} around ${timeText}. Would you like me to automatically create this reminder ${frequencyText} so you don't have to?`;

      // Create notification
      await Notification.create({
        userId,
        type: 'pattern_detected',
        title: 'Pattern Detected - Automate?',
        message,
        data: {
          patternId: pattern._id,
          action: 'offer_automation',
        },
        priority: pattern.priority,
      });

      // Update pattern metadata
      pattern.metadata.automationOfferedAt = new Date();
      await pattern.save();

      logger.info(`[PatternDetection] Offered automation for pattern: ${pattern.title} to user ${userId}`);
    } catch (error) {
      logger.error('[PatternDetection] Error offering automation:', error);
    }
  }

  /**
   * Get day name from day number
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }

  /**
   * Get custom days text (e.g., "Monday, Wednesday, and Friday")
   */
  private getCustomDaysText(customDays: number[]): string {
    const dayNames = customDays.map(d => this.getDayName(d));
    if (dayNames.length === 1) return dayNames[0];
    if (dayNames.length === 2) return dayNames.join(' and ');
    return dayNames.slice(0, -1).join(', ') + ', and ' + dayNames[dayNames.length - 1];
  }

  /**
   * Check for forgotten activities across all users (or specific user)
   */
  async checkForgottenActivities(userId?: string | mongoose.Types.ObjectId): Promise<ForgottenActivity[]> {
    try {
      const query: any = {
        autoCreated: true, // Only check patterns user has accepted automation for
      };

      if (userId) {
        query.userId = userId;
      }

      const patterns = await Pattern.find(query).populate('userId');

      const forgotten: ForgottenActivity[] = [];
      const now = new Date();

      for (const pattern of patterns) {
        // Determine grace period based on priority
        let gracePeriodMinutes = 30;
        if (pattern.priority === 'critical') {
          gracePeriodMinutes = 15;
        } else if (pattern.priority === 'high') {
          gracePeriodMinutes = 20;
        } else if (pattern.priority === 'low') {
          gracePeriodMinutes = 60;
        }

        // Check if activity is forgotten
        if (pattern.isForgotten(gracePeriodMinutes)) {
          const minutesLate = Math.floor(pattern.getTimeSinceScheduled() / (1000 * 60));

          forgotten.push({
            pattern,
            user: pattern.userId,
            minutesLate,
            gracePeriodMinutes,
          });
        }
      }

      logger.info(`[PatternDetection] Found ${forgotten.length} forgotten activities`);

      return forgotten;
    } catch (error) {
      logger.error('[PatternDetection] Error checking forgotten activities:', error);
      return [];
    }
  }

  /**
   * Send forgotten activity reminder notification
   */
  async sendForgottenReminder(forgottenActivity: ForgottenActivity): Promise<void> {
    try {
      const { pattern, user, minutesLate } = forgottenActivity;
      const assistantName = user.assistantName || 'Yo';

      // Craft friendly reminder message based on priority
      let message = '';

      if (pattern.priority === 'critical') {
        message = `⚠️ Boss! Time for your ${pattern.title}. You usually take care of this at ${pattern.timing.hour}:${pattern.timing.minute.toString().padStart(2, '0')}.`;
      } else if (pattern.priority === 'high') {
        message = `Hey Boss! I noticed you usually ${pattern.title} around this time every ${pattern.frequency === 'daily' ? 'day' : 'week'}, but haven't yet today. Want a reminder?`;
      } else {
        message = `Boss! Time for your ${pattern.title}? You usually handle this around ${pattern.timing.hour}:${pattern.timing.minute.toString().padStart(2, '0')}!`;
      }

      // Create notification
      await Notification.create({
        userId: pattern.userId,
        type: 'forgotten_activity',
        title: `Forgotten: ${pattern.title}`,
        message,
        data: {
          patternId: pattern._id,
          action: 'forgotten_reminder',
          minutesLate,
        },
        priority: pattern.priority,
      });

      // Update pattern metadata
      if (!pattern.metadata.missedCount) {
        pattern.metadata.missedCount = 0;
      }
      pattern.metadata.missedCount += 1;
      await pattern.save();

      logger.info(`[PatternDetection] Sent forgotten reminder for: ${pattern.title} to user ${pattern.userId} (${minutesLate} min late)`);
    } catch (error) {
      logger.error('[PatternDetection] Error sending forgotten reminder:', error);
    }
  }

  /**
   * Accept pattern automation (user accepted the offer)
   */
  async acceptAutomation(userId: string, patternId: string | mongoose.Types.ObjectId): Promise<IPattern | null> {
    try {
      const pattern = await Pattern.findOne({ _id: patternId, userId });
      if (!pattern) return null;

      pattern.userResponse = 'accepted';
      pattern.autoCreated = true;
      await pattern.save();

      logger.info(`[PatternDetection] User accepted automation for pattern: ${pattern.title}`);

      // Create initial recurring reminder (this would integrate with your reminder system)
      // For now, just log it
      logger.info(`[PatternDetection] Should create recurring reminder for: ${pattern.title}`);

      return pattern;
    } catch (error) {
      logger.error('[PatternDetection] Error accepting automation:', error);
      return null;
    }
  }

  /**
   * Decline pattern automation (user declined the offer)
   */
  async declineAutomation(userId: string, patternId: string | mongoose.Types.ObjectId): Promise<IPattern | null> {
    try {
      const pattern = await Pattern.findOne({ _id: patternId, userId });
      if (!pattern) return null;

      pattern.userResponse = 'declined';
      pattern.metadata.declinedAt = new Date();
      await pattern.save();

      logger.info(`[PatternDetection] User declined automation for pattern: ${pattern.title}`);

      return pattern;
    } catch (error) {
      logger.error('[PatternDetection] Error declining automation:', error);
      return null;
    }
  }
}

export default new PAPatternDetectionService();
