import { Router } from 'express';
import { conversationController } from '../controllers/conversationController';
import { optimizedConversationController } from '../controllers/optimizedConversationController';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';

// Configure multer for audio file uploads
const audioUpload = multer({
  dest: 'uploads/audio/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

const router = Router();

// All conversation routes require authentication
router.use(authenticateToken);

// Conversation CRUD operations
router.get('/', conversationController.getConversations);
router.post('/', conversationController.createConversation);
router.get('/:id', conversationController.getConversation);
router.get('/:id/summary', conversationController.getConversationSummary);
router.delete('/:id', conversationController.deleteConversation);

// Chat history endpoints (text-only)
router.get('/history/text-only', conversationController.getChatHistory);
router.get('/history/all-messages', conversationController.getAllMessages);

// Message operations
router.post('/:id/messages', conversationController.addMessage);
router.delete('/:id/messages', conversationController.clearMessages);

// Context operations
router.put('/:id/context', conversationController.updateContext);

// Real-time chat operations
router.post('/send-message', conversationController.sendMessage);
router.post('/send-message-optimized', optimizedConversationController.sendMessageOptimized); // NEW: 50% faster, 50% cheaper
router.post('/transcribe', audioUpload.single('audio'), conversationController.transcribeAndRespond);

// Voice conversation operations
router.post('/voice-session', conversationController.saveVoiceSession);
router.post('/extract-tasks', conversationController.extractTasksFromConversation);

// Memory and analytics operations
router.get('/stats/analytics', conversationController.getConversationStats);
router.post('/:id/summarize', conversationController.summarizeConversation);
router.post('/archive/old', conversationController.archiveOldConversations);

export default router;