import express, { Request, Response, NextFunction } from 'express';
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
    console.log('🔍 Multer fileFilter:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    const allowedMimes = [
      'audio/mp4',
      'audio/m4a',
      'audio/mpeg',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/x-m4a', // Some clients send this
    ];

    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.m4a')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format: ${file.mimetype}. Supported: M4A, MP3, WAV, WebM, OGG`));
    }
  }
});

// Multer error handler
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      code: err.code,
    });
  } else if (err) {
    console.error('Upload error:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed',
    });
  }
  next();
};

/**
 * POST /api/transcription/whisper
 * Transcribe audio using OpenAI Whisper
 */
router.post('/whisper', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  console.log('📨 Received transcription request');
  console.log('Headers:', req.headers);
  console.log('Content-Type:', req.get('Content-Type'));
  next();
}, upload.single('audio'), handleMulterError, async (req: any, res: Response) => {
  try {
    console.log('📦 Multer processed request');
    console.log('File received:', !!req.file);
    console.log('Body:', req.body);

    if (!req.file) {
      console.error('❌ No audio file in request');
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
        debug: {
          hasFile: !!req.file,
          contentType: req.get('Content-Type'),
          bodyKeys: Object.keys(req.body || {}),
        }
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
 * POST /api/transcription/generate-title
 * Generate a smart title from transcript text using AI
 */
router.post('/generate-title', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transcript text is required'
      });
    }

    console.log('🎯 Generating title for transcript...');

    const title = await transcriptionService.generateTitle(transcript);

    res.json({
      success: true,
      data: {
        title,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Title generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Title generation failed',
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