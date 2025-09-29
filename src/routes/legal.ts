import express from 'express';
import LegalController from '../controllers/legalController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Public routes - no authentication required
router.get('/terms', LegalController.getTerms);
router.get('/privacy', LegalController.getPrivacy);
router.get('/combined', LegalController.getCombined);
router.get('/all', LegalController.getAllContent);

// Semi-protected routes - optional authentication for anonymous acceptance
router.post('/accept', optionalAuth, LegalController.acceptLegal);
router.get('/status', authenticate, LegalController.getAcceptanceStatus);
router.get('/history', authenticate, LegalController.getAcceptanceHistory);

// Admin routes - admin authentication required
// Note: Add admin authentication middleware when available
router.post('/content', LegalController.createContent);

export default router;