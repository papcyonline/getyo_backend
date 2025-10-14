import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

// Notification CRUD operations
router.get('/', notificationController.getNotifications);
router.get('/count', notificationController.getNotificationCount);
router.get('/recent', notificationController.getRecent);
router.post('/', notificationController.createNotification);
router.delete('/:id', notificationController.deleteNotification);

// Special operations
router.post('/:id/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);
router.delete('/read/clear', notificationController.clearAllRead);

export default router;
