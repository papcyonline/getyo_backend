import { Response } from 'express';
import Pattern, { IPattern } from '../models/Pattern';
import { AuthRequest } from '../types';
import patternService from '../services/paPatternDetectionService';

export const patternController = {
  // Get all patterns for a user
  async getPatterns(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const {
        frequency,
        type,
        userResponse,
        priority,
        autoCreated,
        sortBy = 'priority',
      } = req.query;

      // Build query
      let query: any = { userId };

      if (frequency) query.frequency = frequency;
      if (type) query.type = type;
      if (userResponse) query.userResponse = userResponse;
      if (priority) query.priority = priority;
      if (autoCreated !== undefined) query.autoCreated = autoCreated === 'true';

      // Build sort
      let sort: any = {};
      if (sortBy === 'priority') {
        // Sort by priority (critical > high > medium > low)
        const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
        sort = { priority: 1 };
      } else if (sortBy === 'consistency') {
        sort = { consistency: -1 }; // Highest consistency first
      } else if (sortBy === 'occurrences') {
        sort = { occurrences: -1 }; // Most occurrences first
      } else if (sortBy === 'recent') {
        sort = { lastOccurrence: -1 }; // Most recent first
      }

      const patterns = await Pattern.find(query).sort(sort);

      res.json({
        success: true,
        data: patterns,
        count: patterns.length,
      });
    } catch (error) {
      console.error('Error fetching patterns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch patterns',
      });
    }
  },

  // Get a specific pattern by ID
  async getPatternById(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const { id } = req.params;

      const pattern = await Pattern.findOne({ _id: id, userId });

      if (!pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found',
        });
      }

      res.json({
        success: true,
        data: pattern,
      });
    } catch (error) {
      console.error('Error fetching pattern:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pattern',
      });
    }
  },

  // Accept automation for a pattern
  async acceptAutomation(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const { id } = req.params;

      console.log(`✅ User accepting automation for pattern: ${id}`);

      // Use pattern service to handle acceptance
      const pattern = await patternService.acceptAutomation(userId, id);

      if (!pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found',
        });
      }

      res.json({
        success: true,
        data: pattern,
        message: 'Automation enabled successfully. Reminders will be created automatically.',
      });
    } catch (error) {
      console.error('Error accepting automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to accept automation',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Decline automation for a pattern
  async declineAutomation(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const { id } = req.params;

      console.log(`❌ User declining automation for pattern: ${id}`);

      // Use pattern service to handle decline
      const pattern = await patternService.declineAutomation(userId, id);

      if (!pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found',
        });
      }

      res.json({
        success: true,
        data: pattern,
        message: 'Automation declined. We won\'t ask about this pattern again.',
      });
    } catch (error) {
      console.error('Error declining automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to decline automation',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Delete a pattern
  async deletePattern(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const { id } = req.params;

      const pattern = await Pattern.findOneAndDelete({ _id: id, userId });

      if (!pattern) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found',
        });
      }

      console.log(`🗑️ Pattern deleted: ${pattern.title}`);

      res.json({
        success: true,
        message: 'Pattern deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting pattern:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete pattern',
      });
    }
  },

  // Get automation suggestions (patterns pending user response)
  async getSuggestions(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Get all patterns with pending user response and high consistency
      const suggestions = await Pattern.find({
        userId,
        userResponse: 'pending',
        consistency: { $gte: 0.6 }, // At least 60% consistency
      })
        .sort({ priority: 1, consistency: -1 }) // Sort by priority, then consistency
        .limit(10); // Limit to top 10 suggestions

      res.json({
        success: true,
        data: suggestions,
        count: suggestions.length,
      });
    } catch (error) {
      console.error('Error fetching automation suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch automation suggestions',
      });
    }
  },

  // Trigger manual pattern detection (for testing or on-demand)
  async triggerDetection(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      console.log(`🔍 Manually triggering pattern detection for user: ${userId}`);

      // Run pattern detection
      const detectedPatterns = await patternService.detectPatternsForUser(userId);

      res.json({
        success: true,
        data: {
          patternsDetected: detectedPatterns.length,
          patterns: detectedPatterns,
        },
        message: `Pattern detection completed. Found ${detectedPatterns.length} patterns.`,
      });
    } catch (error) {
      console.error('Error triggering pattern detection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger pattern detection',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Check for forgotten activities
  async checkForgottenActivities(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      console.log(`🔍 Checking forgotten activities for user: ${userId}`);

      // Check for forgotten activities
      const forgottenActivities = await patternService.checkForgottenActivities(userId);

      // Send reminders for each forgotten activity
      for (const activity of forgottenActivities) {
        await patternService.sendForgottenReminder(activity);
      }

      res.json({
        success: true,
        data: {
          forgottenCount: forgottenActivities.length,
          activities: forgottenActivities,
        },
        message: `Found ${forgottenActivities.length} forgotten activities. Reminders sent.`,
      });
    } catch (error) {
      console.error('Error checking forgotten activities:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check forgotten activities',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Get pattern statistics
  async getStatistics(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const [
        totalPatterns,
        activeAutomations,
        pendingSuggestions,
        declinedPatterns,
        criticalPatterns,
      ] = await Promise.all([
        Pattern.countDocuments({ userId }),
        Pattern.countDocuments({ userId, autoCreated: true, userResponse: 'accepted' }),
        Pattern.countDocuments({ userId, userResponse: 'pending', consistency: { $gte: 0.6 } }),
        Pattern.countDocuments({ userId, userResponse: 'declined' }),
        Pattern.countDocuments({ userId, priority: 'critical' }),
      ]);

      // Get consistency distribution
      const patterns = await Pattern.find({ userId });
      const avgConsistency = patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.consistency, 0) / patterns.length
        : 0;

      res.json({
        success: true,
        data: {
          totalPatterns,
          activeAutomations,
          pendingSuggestions,
          declinedPatterns,
          criticalPatterns,
          averageConsistency: Math.round(avgConsistency * 100) / 100,
        },
      });
    } catch (error) {
      console.error('Error fetching pattern statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pattern statistics',
      });
    }
  },
};
