import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  exportUserData,
  getCacheStats,
  clearCache,
  deleteAccount,
} from '../controllers/dataManagementController';

const router = Router();

// All data management routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/data-management/export
 * @desc    Export all user data (JSON or ZIP format)
 * @access  Private
 */
router.post('/export', exportUserData);

/**
 * @route   GET /api/data-management/cache/stats
 * @desc    Get cache statistics
 * @access  Private
 */
router.get('/cache/stats', getCacheStats);

/**
 * @route   POST /api/data-management/cache/clear
 * @desc    Clear app cache (sessions and temporary data)
 * @access  Private
 */
router.post('/cache/clear', clearCache);

/**
 * @route   DELETE /api/data-management/account
 * @desc    Delete user account and all associated data
 * @access  Private
 */
router.delete('/account', deleteAccount);

export default router;
