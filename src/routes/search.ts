import { Router } from 'express';
import {
  search,
  getAiSummary,
  getRecentSearches,
  getSuggestions,
  clearRecentSearches,
} from '../controllers/searchController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All search routes require authentication
router.use(authenticateToken);

// Search endpoints
router.post('/', search);
router.post('/ai-summary', getAiSummary);
router.get('/recent', getRecentSearches);
router.get('/suggestions', getSuggestions);
router.delete('/recent', clearRecentSearches);

export default router;
