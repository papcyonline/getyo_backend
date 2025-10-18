import { Router } from 'express';
import { reminderController } from '../controllers/reminderController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All reminder routes require authentication
router.use(authenticateToken);

// AI-powered extraction
router.post('/extract-from-voice', reminderController.extractReminderFromVoice);

// Reminder CRUD operations
router.get('/', reminderController.getReminders);
router.get('/upcoming', reminderController.getUpcomingReminders);
router.get('/overdue', reminderController.getOverdueReminders);
router.post('/', reminderController.createReminder);
router.put('/:id', reminderController.updateReminder);
router.delete('/:id', reminderController.deleteReminder);

// Special operations
router.post('/:id/snooze', reminderController.snoozeReminder);
router.post('/:id/toggle-status', reminderController.toggleReminderStatus);

export default router;