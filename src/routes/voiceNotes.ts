import { Router } from 'express';
import { voiceNoteController, upload } from '../controllers/voiceNoteController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All voice note routes require authentication
router.use(authenticateToken);

// Voice note CRUD operations
router.get('/', voiceNoteController.getVoiceNotes);
router.get('/search', voiceNoteController.searchVoiceNotes);
router.get('/:id', voiceNoteController.getVoiceNote);
router.post('/', upload.single('audio'), voiceNoteController.createVoiceNote);
router.put('/:id', voiceNoteController.updateVoiceNote);
router.delete('/:id', voiceNoteController.deleteVoiceNote);

export default router;
