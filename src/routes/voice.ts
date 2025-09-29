import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import VoiceProcessingService from '../services/VoiceProcessingService';
import { ApiResponse } from '../types';
import { openaiService } from '../services/openaiService';
import { User } from '../models';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || file.originalname.endsWith('.wav')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

// Apply auth middleware to all routes
router.use(authenticateToken);

// @route   POST /api/voice/process
// @desc    Process voice input (transcription)
// @access  Private
router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required',
      } as ApiResponse<null>);
    }

    // Process the audio buffer
    const result = await VoiceProcessingService.processVoiceInput({
      audioData: req.file.buffer,
      userId,
    });

    res.json({
      success: true,
      data: result,
    } as ApiResponse<typeof result>);
  } catch (error) {
    console.error('Voice processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process voice input',
    } as ApiResponse<null>);
  }
});

// @route   POST /api/voice/synthesize
// @desc    Convert text to speech using OpenAI TTS
// @access  Private
router.post('/synthesize', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    let { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      } as ApiResponse<null>);
    }

    if (text.length > 4096) {
      return res.status(400).json({
        success: false,
        error: 'Text too long. Maximum 4096 characters.',
      } as ApiResponse<null>);
    }

    // Get user's selected voice if not provided
    if (!voice && userId) {
      const user = await User.findById(userId);
      voice = user?.assistantVoice || 'alloy';
    }

    voice = voice || 'alloy';

    // Validate voice
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (!validVoices.includes(voice)) {
      return res.status(400).json({
        success: false,
        error: `Invalid voice. Must be one of: ${validVoices.join(', ')}`,
      } as ApiResponse<null>);
    }

    // Generate speech using OpenAI TTS
    const audioBuffer = await openaiService.generateSpeech(text, voice);

    if (!audioBuffer) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate speech audio',
      } as ApiResponse<null>);
    }

    // Return audio as MP3
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.send(audioBuffer);

  } catch (error) {
    console.error('Voice synthesis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to synthesize voice',
    } as ApiResponse<null>);
  }
});

export default router;