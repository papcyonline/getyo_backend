import { Router } from 'express';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { authenticateToken } from '../middleware/auth';
import Feedback from '../models/Feedback';
import ProfileLearningService from '../services/ProfileLearningService';
import logger from '../utils/logger';

const router = Router();

// All feedback routes require authentication
router.use(authenticateToken);

/**
 * Submit feedback on a PA response
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const {
      conversationId,
      messageId,
      userMessage,
      paResponse,
      rating,
      specificIssue,
      expectedResponse,
      correctedAction,
      actionsCreated,
      needsClarification,
      clarificationProvided,
      responseTimeMs,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Validate required fields
    if (!conversationId || !messageId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'conversationId, messageId, and rating are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'rating must be between 1 and 5',
      });
    }

    // Determine feedback type
    let feedbackType: 'positive' | 'negative' | 'neutral';
    if (rating >= 4) feedbackType = 'positive';
    else if (rating <= 2) feedbackType = 'negative';
    else feedbackType = 'neutral';

    // Create feedback
    const feedback = new Feedback({
      userId,
      conversationId,
      messageId,
      userMessage,
      paResponse,
      rating,
      feedbackType,
      specificIssue,
      expectedResponse,
      correctedAction,
      actionsCreated: actionsCreated || [],
      needsClarification: needsClarification || false,
      clarificationProvided: clarificationProvided || false,
      responseTimeMs: responseTimeMs || 0,
    });

    await feedback.save();

    // Learn from feedback
    if (feedbackType === 'positive') {
      await ProfileLearningService.recordSuccess(userId);
    } else if (feedbackType === 'negative') {
      await ProfileLearningService.recordFailure(userId);

      // If user says action was incorrect, learn to avoid similar suggestions
      if (specificIssue === 'incorrect_action' && correctedAction) {
        await ProfileLearningService.addDislikedSuggestion(userId, correctedAction);
      }
    }

    logger.info(`[Feedback] ${feedbackType.toUpperCase()} feedback received from user ${userId}: ${rating}/5`);

    res.json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    logger.error('[Feedback] Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback',
    });
  }
});

/**
 * Get user's feedback history
 */
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const feedbackList = await Feedback.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .lean();

    res.json({
      success: true,
      data: feedbackList,
      count: feedbackList.length,
    });
  } catch (error) {
    logger.error('[Feedback] Error fetching history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback history',
    });
  }
});

/**
 * Get user's average rating
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const stats = await (Feedback as any).getUserAverageRating(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('[Feedback] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    });
  }
});

export default router;
