import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import VoiceProcessingService from '../services/VoiceProcessingService';
import { ApiResponse } from '../types';
import { openaiService } from '../services/openaiService';
import { User } from '../models';
import Task from '../models/Task';
import Event from '../models/Event';
import Reminder from '../models/Reminder';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

// @route   POST /api/voice/process-command
// @desc    Process voice command and automatically create entities (tasks/reminders/events)
// @access  Private
router.post('/process-command', async (req, res) => {
  let tempFilePath: string | null = null;

  try {
    const userId = (req as any).user?.userId;
    const { audioData, audioFormat = 'wav' } = req.body;

    if (!audioData) {
      return res.status(400).json({
        success: false,
        error: 'Audio data is required (base64 encoded)',
      } as ApiResponse<null>);
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Create temporary file for Whisper
    tempFilePath = path.join(os.tmpdir(), `voice-${Date.now()}.${audioFormat}`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    // Step 1: Transcribe audio using Whisper
    console.log('Transcribing audio...');
    const transcriptionResult = await openaiService.transcribeAudio(tempFilePath);

    if (!transcriptionResult.success || !transcriptionResult.transcript) {
      return res.status(500).json({
        success: false,
        error: transcriptionResult.error || 'Failed to transcribe audio',
      } as ApiResponse<null>);
    }

    const transcription = transcriptionResult.transcript;
    console.log('Transcription:', transcription);

    // Step 2: Extract intent and entities using GPT-4
    console.log('Extracting intent...');
    const intentPrompt = `You are an AI assistant that extracts intent and entities from user commands.

User said: "${transcription}"

Analyze this command and respond ONLY with valid JSON in this exact format:
{
  "action": "create_task" | "create_reminder" | "create_event" | "query" | "unknown",
  "entity": {
    "title": "string (required for all actions)",
    "description": "string (optional)",
    "dueDate": "ISO date string (for tasks)",
    "priority": "low" | "medium" | "high" (for tasks, default medium)",
    "reminderTime": "ISO date string (for reminders)",
    "isUrgent": boolean (for reminders, default false),
    "startTime": "ISO date string (for events)",
    "endTime": "ISO date string (for events)",
    "location": "string (for events)"
  },
  "confidence": number (0-1)
}

Rules:
- For relative times like "tomorrow at 3pm", "in 2 hours", "next Monday", calculate the actual ISO datetime
- Current datetime: ${new Date().toISOString()}
- If no specific time is mentioned for reminders, use a reasonable default (e.g., 9am tomorrow)
- For events without end time, default to 1 hour duration
- Extract priority from keywords: "urgent/critical/important" = high, "low priority/minor" = low, otherwise medium
- Only return the JSON, no explanations`;

    const openai = new (require('openai')).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const intentResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts structured data from natural language. Always respond with valid JSON.' },
        { role: 'user', content: intentPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const intentData = JSON.parse(intentResponse.choices[0].message.content || '{}');
    console.log('Intent extracted:', intentData);

    // Step 3: Create the appropriate entity based on action
    let createdEntity: any = null;
    let actionType = intentData.action;
    let confirmationMessage = '';

    if (intentData.action === 'create_task') {
      const task = new Task({
        userId,
        title: intentData.entity.title,
        description: intentData.entity.description,
        priority: intentData.entity.priority || 'medium',
        dueDate: intentData.entity.dueDate ? new Date(intentData.entity.dueDate) : undefined,
        status: 'pending',
        createdBy: 'user',
      });

      createdEntity = await task.save();
      confirmationMessage = `Task created: "${createdEntity.title}"${createdEntity.dueDate ? ` due ${new Date(createdEntity.dueDate).toLocaleDateString()}` : ''}`;

    } else if (intentData.action === 'create_reminder') {
      const reminder = new Reminder({
        userId,
        title: intentData.entity.title,
        notes: intentData.entity.description,
        reminderTime: intentData.entity.reminderTime ? new Date(intentData.entity.reminderTime) : new Date(Date.now() + 24 * 60 * 60 * 1000), // Default tomorrow
        isUrgent: intentData.entity.isUrgent || false,
        status: 'active',
        repeatType: 'none',
      });

      createdEntity = await reminder.save();
      confirmationMessage = `Reminder set: "${createdEntity.title}" at ${new Date(createdEntity.reminderTime).toLocaleString()}`;

    } else if (intentData.action === 'create_event') {
      const startTime = intentData.entity.startTime ? new Date(intentData.entity.startTime) : new Date();
      const endTime = intentData.entity.endTime
        ? new Date(intentData.entity.endTime)
        : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour duration

      const event = new Event({
        userId,
        title: intentData.entity.title,
        description: intentData.entity.description,
        startTime,
        endTime,
        location: intentData.entity.location,
        source: 'manual',
      });

      createdEntity = await event.save();
      confirmationMessage = `Event created: "${createdEntity.title}" on ${new Date(createdEntity.startTime).toLocaleString()}`;

    } else if (intentData.action === 'query') {
      confirmationMessage = `I heard: "${transcription}". This appears to be a question. How can I help you?`;
      actionType = 'query';
    } else {
      confirmationMessage = `I heard: "${transcription}". I'm not sure what you want me to do. Could you rephrase?`;
      actionType = 'unknown';
    }

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
    }

    // Step 4: Return response
    res.json({
      success: true,
      data: {
        transcription,
        action: actionType,
        entity: createdEntity,
        confidence: intentData.confidence || 0.8,
        message: confirmationMessage,
      },
    } as ApiResponse<any>);

  } catch (error: any) {
    console.error('Voice command processing error:', error);

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process voice command',
    } as ApiResponse<null>);
  }
});

export default router;