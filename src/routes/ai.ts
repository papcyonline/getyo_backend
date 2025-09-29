import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All AI routes require authentication
router.use(authenticateToken);

// AI operations
router.post('/chat', aiController.chat);
router.post('/process-command', aiController.processCommand);
router.get('/suggestions', aiController.getSuggestions);
router.get('/daily-briefing', aiController.getDailyBriefing);

export default router;