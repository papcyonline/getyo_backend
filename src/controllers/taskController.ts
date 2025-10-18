import { Request, Response } from 'express';
import Task from '../models/Task';
import { AuthRequest } from '../types';
import { openaiService } from '../services/openaiService';

export const taskController = {
  // Get all tasks for a user
  async getTasks(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { status, priority, category, sortBy, limit } = req.query;

      let query: any = { userId };

      // Apply filters
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (category) query.category = category;

      let tasksQuery = Task.find(query);

      // Apply sorting
      switch (sortBy) {
        case 'dueDate':
          tasksQuery = tasksQuery.sort({ dueDate: 1 });
          break;
        case 'priority':
          tasksQuery = tasksQuery.sort({ priority: -1, dueDate: 1 });
          break;
        case 'createdAt':
          tasksQuery = tasksQuery.sort({ createdAt: -1 });
          break;
        default:
          tasksQuery = tasksQuery.sort({ status: 1, priority: -1, dueDate: 1 });
      }

      // Apply limit
      if (limit) {
        tasksQuery = tasksQuery.limit(parseInt(limit as string));
      }

      const tasks = await tasksQuery;

      res.json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks',
      });
    }
  },

  // Get a single task
  async getTask(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const task = await Task.findOne({ _id: id, userId });

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      res.json({
        success: true,
        data: task,
      });
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch task',
      });
    }
  },

  // Create a new task
  async createTask(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const taskData = {
        ...req.body,
        userId,
      };

      const task = new Task(taskData);
      await task.save();

      res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully',
      });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create task',
      });
    }
  },

  // Update a task
  async updateTask(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const updates = req.body;

      // Prevent updating userId
      delete updates.userId;

      const task = await Task.findOneAndUpdate(
        { _id: id, userId },
        updates,
        { new: true, runValidators: true }
      );

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      res.json({
        success: true,
        data: task,
        message: 'Task updated successfully',
      });
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update task',
      });
    }
  },

  // Delete a task
  async deleteTask(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const task = await Task.findOneAndDelete({ _id: id, userId });

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      res.json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete task',
      });
    }
  },

  // Bulk update tasks (e.g., mark multiple as completed)
  async bulkUpdateTasks(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { taskIds, updates } = req.body;

      if (!taskIds || !Array.isArray(taskIds)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid task IDs',
        });
      }

      // Prevent updating userId
      delete updates.userId;

      const result = await Task.updateMany(
        { _id: { $in: taskIds }, userId },
        updates
      );

      res.json({
        success: true,
        data: {
          matched: result.matchedCount,
          modified: result.modifiedCount,
        },
        message: 'Tasks updated successfully',
      });
    } catch (error) {
      console.error('Error bulk updating tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update tasks',
      });
    }
  },

  // Get task statistics
  async getTaskStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;

      const stats = await Task.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            high: {
              $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] },
            },
            urgent: {
              $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] },
            },
            medium: {
              $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] },
            },
            low: {
              $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] },
            },
          },
        },
      ]);

      const taskStats = stats[0] || {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        cancelled: 0,
        high: 0,
        urgent: 0,
        medium: 0,
        low: 0,
      };

      res.json({
        success: true,
        data: taskStats,
      });
    } catch (error) {
      console.error('Error fetching task statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch task statistics',
      });
    }
  },

  // Search tasks
  async searchTasks(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
      }

      const tasks = await (Task as any).searchTasks(userId, query);

      res.json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    } catch (error) {
      console.error('Error searching tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search tasks',
      });
    }
  },

  // Get overdue tasks
  async getOverdueTasks(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const tasks = await (Task as any).getOverdueTasks(userId);

      res.json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    } catch (error) {
      console.error('Error fetching overdue tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch overdue tasks',
      });
    }
  },

  // Get upcoming tasks
  async getUpcomingTasks(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const tasks = await (Task as any).getUpcomingTasks(userId, days);

      res.json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    } catch (error) {
      console.error('Error fetching upcoming tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upcoming tasks',
      });
    }
  },

  // Add subtask to a task
  async addSubtask(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Subtask text is required',
        });
      }

      const task = await Task.findOne({ _id: id, userId });

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      await (task as any).addSubtask(text);

      res.json({
        success: true,
        data: task,
        message: 'Subtask added successfully',
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add subtask',
      });
    }
  },

  // Toggle subtask completion
  async toggleSubtask(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id, subtaskId } = req.params;

      const task = await Task.findOne({ _id: id, userId });

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      await (task as any).toggleSubtask(subtaskId);

      res.json({
        success: true,
        data: task,
        message: 'Subtask toggled successfully',
      });
    } catch (error: any) {
      console.error('Error toggling subtask:', error);
      res.status(error.message === 'Subtask not found' ? 404 : 500).json({
        success: false,
        error: error.message || 'Failed to toggle subtask',
      });
    }
  },

  // Mark task as completed
  async markCompleted(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const task = await Task.findOne({ _id: id, userId });

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      await (task as any).markCompleted();

      res.json({
        success: true,
        data: task,
        message: 'Task marked as completed',
      });
    } catch (error) {
      console.error('Error marking task as completed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark task as completed',
      });
    }
  },

  // Extract structured task data from voice transcript using AI
  async extractFromVoice(req: AuthRequest, res: Response) {
    try {
      const { transcript, recordedAt } = req.body;

      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Transcript is required',
        });
      }

      // Use recordedAt if provided, otherwise use current time
      const referenceDate = recordedAt ? new Date(recordedAt) : new Date();

      console.log('🎯 Extracting task from transcript:', transcript);
      console.log('📅 Reference date:', referenceDate.toISOString());

      const result = await openaiService.extractTaskFromTranscript(
        transcript,
        referenceDate
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to extract task data',
        });
      }

      console.log('✅ AI extracted data:', result.data);

      res.json({
        success: true,
        data: result.data,
        message: 'Task data extracted successfully',
      });
    } catch (error) {
      console.error('Error extracting task from voice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to extract task data',
      });
    }
  },
};