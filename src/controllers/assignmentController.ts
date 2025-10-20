import { Response } from 'express';
import Assignment from '../models/Assignment';
import { AuthRequest } from '../types';
import assignmentProcessingJob from '../jobs/assignmentProcessingJob';
import logger from '../utils/logger';
import { AssignmentStatus } from '../constants/statuses';

export const assignmentController = {
  /**
   * Get all assignments for a user
   * Sorted by createdAt DESC (newest first)
   */
  async getAssignments(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { status, type, limit = 50, offset = 0 } = req.query;

      // Build filter
      const filter: any = { userId };
      if (status) {
        filter.status = status;
      }
      if (type) {
        filter.type = type;
      }

      const assignments = await Assignment.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(offset as string));

      const total = await Assignment.countDocuments(filter);

      res.json({
        success: true,
        data: assignments,
        count: assignments.length,
        total,
      });
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assignments',
      });
    }
  },

  /**
   * Get a single assignment by ID
   */
  async getAssignment(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const assignment = await Assignment.findOne({ _id: id, userId });

      if (!assignment) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
        });
      }

      res.json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      console.error('Error fetching assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assignment',
      });
    }
  },

  /**
   * Get assignment statistics
   */
  async getAssignmentStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;

      const [total, inProgress, completed, failed] = await Promise.all([
        Assignment.countDocuments({ userId }),
        Assignment.countDocuments({ userId, status: AssignmentStatus.IN_PROGRESS }),
        Assignment.countDocuments({ userId, status: AssignmentStatus.COMPLETED }),
        Assignment.countDocuments({ userId, status: AssignmentStatus.FAILED }),
      ]);

      // Get recent completed assignments
      const recentCompleted = await Assignment.find({
        userId,
        status: AssignmentStatus.COMPLETED,
      })
        .sort({ completedAt: -1 })
        .limit(5)
        .select('title type completedAt findings');

      res.json({
        success: true,
        data: {
          total,
          inProgress,
          completed,
          failed,
          recentCompleted,
        },
      });
    } catch (error) {
      console.error('Error fetching assignment stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assignment statistics',
      });
    }
  },

  /**
   * Delete an assignment
   */
  async deleteAssignment(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const assignment = await Assignment.findOneAndDelete({ _id: id, userId });

      if (!assignment) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
        });
      }

      res.json({
        success: true,
        message: 'Assignment deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete assignment',
      });
    }
  },

  /**
   * Mark assignment as viewed/read
   */
  async markAsViewed(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const assignment = await Assignment.findOneAndUpdate(
        { _id: id, userId },
        { viewed: true, viewedAt: new Date() },
        { new: true }
      );

      if (!assignment) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
        });
      }

      res.json({
        success: true,
        data: assignment,
        message: 'Assignment marked as viewed',
      });
    } catch (error) {
      console.error('Error marking assignment as viewed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark assignment as viewed',
      });
    }
  },

  /**
   * Manually retry a failed assignment
   */
  async retryAssignment(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const assignment = await Assignment.findOne({ _id: id, userId });

      if (!assignment) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
        });
      }

      // Reset status to in_progress
      assignment.status = AssignmentStatus.IN_PROGRESS;
      assignment.findings = '';
      assignment.notificationSent = false;
      await assignment.save();

      // Re-queue the assignment
      await assignmentProcessingJob.queue(String(assignment._id));

      logger.info(`[AssignmentController] Manually re-queued assignment: ${assignment._id}`);

      res.json({
        success: true,
        data: assignment,
        message: 'Assignment queued for retry',
      });
    } catch (error) {
      logger.error('Error retrying assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry assignment',
      });
    }
  },
};
