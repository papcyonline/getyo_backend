import { Router } from 'express';
import { taskController } from '../controllers/taskController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All task routes require authentication
router.use(authenticateToken);

// Task queries (must come before :id routes)
router.get('/stats', taskController.getTaskStats);
router.get('/search', taskController.searchTasks);
router.get('/overdue', taskController.getOverdueTasks);
router.get('/upcoming', taskController.getUpcomingTasks);

// AI task extraction from voice
router.post('/extract-from-voice', taskController.extractFromVoice);

// Task CRUD operations
router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTask);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// Bulk operations
router.patch('/bulk', taskController.bulkUpdateTasks);

// Task completion
router.patch('/:id/complete', taskController.markCompleted);

// Subtask operations
router.post('/:id/subtasks', taskController.addSubtask);
router.patch('/:id/subtasks/:subtaskId/toggle', taskController.toggleSubtask);

export default router;