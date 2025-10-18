import { Request, Response } from 'express';
import VoiceNote from '../models/VoiceNote';
import { AuthRequest } from '../types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cloudinaryService from '../services/cloudinaryService';

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/voice-notes');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `voice-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /m4a|mp3|wav|aac|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export const voiceNoteController = {
  // Create a new voice note
  async createVoiceNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { title, transcript, duration, tags, location } = req.body;

      // Parse tags if it's a string
      let parsedTags = tags;
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = [];
        }
      }

      const voiceNoteData: any = {
        userId,
        title,
        transcript,
        duration: parseInt(duration),
        tags: parsedTags,
        location,
      };

      // Upload audio to Cloudinary if file was uploaded
      if (req.file) {
        try {
          const cloudinaryResult = await cloudinaryService.uploadAudio(req.file.path, {
            folder: 'voice-notes',
            publicId: `voice_${userId}_${Date.now()}`,
          });

          voiceNoteData.audioUrl = cloudinaryResult.secureUrl;
          console.log('☁️ Audio uploaded to Cloudinary:', cloudinaryResult.secureUrl);
        } catch (cloudinaryError) {
          console.error('Cloudinary upload failed:', cloudinaryError);
          // Fall back to local storage
          voiceNoteData.audioUrl = `/uploads/voice-notes/${req.file.filename}`;
        }
      }

      const voiceNote = new VoiceNote(voiceNoteData);
      await voiceNote.save();

      console.log('✅ Voice note saved:', voiceNote._id);

      res.status(201).json({
        success: true,
        data: voiceNote,
        message: 'Voice note created successfully',
      });
    } catch (error) {
      console.error('Error creating voice note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create voice note',
      });
    }
  },

  // Get all voice notes for a user
  async getVoiceNotes(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit as string) || 20;

      const voiceNotes = await VoiceNote.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit);

      res.json({
        success: true,
        data: voiceNotes,
        count: voiceNotes.length,
      });
    } catch (error) {
      console.error('Error fetching voice notes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch voice notes',
      });
    }
  },

  // Get a single voice note
  async getVoiceNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const voiceNote = await VoiceNote.findOne({ _id: id, userId });

      if (!voiceNote) {
        return res.status(404).json({
          success: false,
          error: 'Voice note not found',
        });
      }

      res.json({
        success: true,
        data: voiceNote,
      });
    } catch (error) {
      console.error('Error fetching voice note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch voice note',
      });
    }
  },

  // Update a voice note
  async updateVoiceNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const updates = req.body;

      // Don't allow userId to be updated
      delete updates.userId;

      const voiceNote = await VoiceNote.findOneAndUpdate(
        { _id: id, userId },
        updates,
        { new: true, runValidators: true }
      );

      if (!voiceNote) {
        return res.status(404).json({
          success: false,
          error: 'Voice note not found',
        });
      }

      res.json({
        success: true,
        data: voiceNote,
        message: 'Voice note updated successfully',
      });
    } catch (error) {
      console.error('Error updating voice note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update voice note',
      });
    }
  },

  // Delete a voice note
  async deleteVoiceNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { id } = req.params;

      const voiceNote = await VoiceNote.findOneAndDelete({ _id: id, userId });

      if (!voiceNote) {
        return res.status(404).json({
          success: false,
          error: 'Voice note not found',
        });
      }

      // Delete audio file from Cloudinary or local storage
      if (voiceNote.audioUrl) {
        if (voiceNote.audioUrl.includes('cloudinary.com')) {
          // Extract public ID from Cloudinary URL
          const urlParts = voiceNote.audioUrl.split('/');
          const publicIdWithExt = urlParts.slice(-2).join('/'); // folder/filename
          const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // remove extension

          try {
            await cloudinaryService.deleteFile(publicId, 'video');
            console.log('☁️ Audio deleted from Cloudinary');
          } catch (error) {
            console.error('Failed to delete from Cloudinary:', error);
          }
        } else {
          // Delete from local storage
          const audioPath = path.join(__dirname, '../../', voiceNote.audioUrl);
          if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
          }
        }
      }

      res.json({
        success: true,
        message: 'Voice note deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting voice note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete voice note',
      });
    }
  },

  // Search voice notes
  async searchVoiceNotes(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
      }

      const voiceNotes = await (VoiceNote as any).searchVoiceNotes(userId, query as string);

      res.json({
        success: true,
        data: voiceNotes,
        count: voiceNotes.length,
      });
    } catch (error) {
      console.error('Error searching voice notes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search voice notes',
      });
    }
  },
};
