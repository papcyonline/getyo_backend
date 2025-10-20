import express from 'express';
import { assignmentController } from '../controllers/assignmentController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/assignments
 * @desc    Get all assignments for authenticated user
 * @access  Private
 * @query   status - Filter by status (in_progress, completed, failed)
 * @query   type - Filter by type (research, comparison, recommendation, etc.)
 * @query   limit - Number of assignments to return (default: 50)
 * @query   offset - Number of assignments to skip (default: 0)
 */
router.get('/', assignmentController.getAssignments);

/**
 * @route   GET /api/assignments/stats
 * @desc    Get assignment statistics
 * @access  Private
 */
router.get('/stats', assignmentController.getAssignmentStats);

/**
 * @route   GET /api/assignments/:id
 * @desc    Get a single assignment by ID
 * @access  Private
 */
router.get('/:id', assignmentController.getAssignment);

/**
 * @route   PATCH /api/assignments/:id/viewed
 * @desc    Mark assignment as viewed
 * @access  Private
 */
router.patch('/:id/viewed', assignmentController.markAsViewed);

/**
 * @route   POST /api/assignments/:id/retry
 * @desc    Manually retry a failed assignment
 * @access  Private
 */
router.post('/:id/retry', assignmentController.retryAssignment);

/**
 * @route   DELETE /api/assignments/:id
 * @desc    Delete an assignment
 * @access  Private
 */
router.delete('/:id', assignmentController.deleteAssignment);

export default router;
