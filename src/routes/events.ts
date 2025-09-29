import { Router } from 'express';
import { eventController } from '../controllers/eventController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All event routes require authentication
router.use(authenticateToken);

// Event CRUD operations
router.get('/', eventController.getEvents);
router.get('/today', eventController.getTodayEvents);
router.get('/upcoming', eventController.getUpcomingEvents);
router.get('/:id', eventController.getEvent);
router.post('/', eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

export default router;