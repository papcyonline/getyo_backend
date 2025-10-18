import { Router } from 'express';
import { sessionController } from '../controllers/sessionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All session routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get all active sessions for current user
 * @access  Private
 */
router.get('/', sessionController.getActiveSessions);

/**
 * @route   GET /api/auth/sessions/stats
 * @desc    Get session statistics
 * @access  Private
 */
router.get('/stats', sessionController.getSessionStats);

/**
 * @route   POST /api/auth/sessions/extend
 * @desc    Extend current session expiry
 * @access  Private
 */
router.post('/extend', sessionController.extendSession);

/**
 * @route   DELETE /api/auth/sessions/others
 * @desc    Terminate all other sessions (keep current)
 * @access  Private
 */
router.delete('/others', sessionController.terminateAllOtherSessions);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Terminate a specific session
 * @access  Private
 */
router.delete('/:sessionId', sessionController.terminateSession);

export default router;
