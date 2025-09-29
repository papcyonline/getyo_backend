import { Router } from 'express';
import { noteController } from '../controllers/noteController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All note routes require authentication
router.use(authenticateToken);

// Note CRUD operations
router.get('/', noteController.getNotes);
router.get('/recent', noteController.getRecentNotes);
router.get('/search', noteController.searchNotes);
router.get('/category/:category', noteController.getNotesByCategory);
router.get('/:id', noteController.getNote);
router.post('/', noteController.createNote);
router.put('/:id', noteController.updateNote);
router.delete('/:id', noteController.deleteNote);

export default router;