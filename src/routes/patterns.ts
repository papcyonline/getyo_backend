import { Router } from 'express';
import { patternController } from '../controllers/patternController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All pattern routes require authentication
router.use(authenticateToken);

// Get pattern statistics
router.get('/statistics', patternController.getStatistics);

// Get automation suggestions
router.get('/suggestions', patternController.getSuggestions);

// Trigger manual pattern detection
router.post('/detect', patternController.triggerDetection);

// Check for forgotten activities
router.post('/check-forgotten', patternController.checkForgottenActivities);

// Pattern CRUD operations
router.get('/', patternController.getPatterns);
router.get('/:id', patternController.getPatternById);
router.delete('/:id', patternController.deletePattern);

// Automation response actions
router.post('/:id/accept', patternController.acceptAutomation);
router.post('/:id/decline', patternController.declineAutomation);

export default router;
