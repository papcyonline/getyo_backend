import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import { transcriptionService } from '../services/transcriptionService';

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/audio');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.m4a`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mp4',
      'audio/m4a',
      'audio/mpeg',
      'audio/wav',
      'audio/webm',
      'audio/ogg'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Supported: M4A, MP3, WAV, WebM, OGG'));
    }
  }
});

/**
 * POST /api/transcription/whisper
 * Transcribe audio using OpenAI Whisper
 */
router.post('/whisper', authenticateToken, upload.single('audio'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    console.log(`🎤 Transcription request from user ${req.user.id}`);
    console.log(`📁 Audio file: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);

    const audioFilePath = req.file.path;
    const startTime = Date.now();

    // Transcribe using OpenAI Whisper
    const result = await transcriptionService.transcribe(audioFilePath, 'whisper');

    const processingTime = Date.now() - startTime;
    console.log(`✅ Transcription completed in ${processingTime}ms using ${result.service}`);

    // Clean up uploaded file
    try {
      fs.unlinkSync(audioFilePath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup audio file:', cleanupError);
    }

    res.json({
      success: true,
      data: {
        text: result.text,
        confidence: result.confidence,
        service: result.service,
        processingTimeMs: processingTime,
        audioSize: req.file.size,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Transcription error:', error);

    // Clean up file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup audio file after error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Transcription failed',
      message: error.message
    });
  }
});

/**
 * POST /api/transcription/vapi
 * Transcribe audio using VAPI.AI
 */
router.post('/vapi', authenticateToken, upload.single('audio'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    console.log(`🎤 VAPI transcription request from user ${req.user.id}`);

    const audioFilePath = req.file.path;
    const startTime = Date.now();

    // Transcribe using VAPI.AI
    const result = await transcriptionService.transcribe(audioFilePath, 'vapi');

    const processingTime = Date.now() - startTime;
    console.log(`✅ VAPI transcription completed in ${processingTime}ms`);

    // Clean up uploaded file
    try {
      fs.unlinkSync(audioFilePath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup audio file:', cleanupError);
    }

    res.json({
      success: true,
      data: {
        text: result.text,
        confidence: result.confidence,
        service: result.service,
        processingTimeMs: processingTime,
        audioSize: req.file.size,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('VAPI transcription error:', error);

    // Clean up file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup audio file after error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'VAPI transcription failed',
      message: error.message
    });
  }
});

/**
 * GET /api/transcription/health
 * Check transcription service health
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = await transcriptionService.healthCheck();

    res.json({
      success: true,
      data: {
        ...health,
        status: health.whisper || health.vapi ? 'healthy' : 'degraded',
        availableServices: [
          ...(health.whisper ? ['whisper'] : []),
          ...(health.vapi ? ['vapi'] : []),
          'mock'
        ],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * GET /api/transcription/test
 * Test endpoint with mock data
 */
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const mockResult = await transcriptionService.transcribe('', 'whisper');

    res.json({
      success: true,
      data: {
        ...mockResult,
        message: 'This is a test response with mock transcription',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message
    });
  }
});

export default router;