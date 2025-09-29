import { Request, Response } from 'express';
import Note from '../models/Note';
import { AuthRequest } from '../types';

export const noteController = {
  // Get all notes for a user
  async getNotes(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { category, search, limit = 50 } = req.query;

      let query: any = { userId };

      if (category) query.category = category;

      let notes;

      if (search) {
        // Use text search if search query is provided
        notes = await (Note as any).searchNotes(userId, search as string);
      } else {
        notes = await Note.find(query)
          .sort({ createdAt: -1 })
          .limit(parseInt(limit as string));
      }

      res.json({
        success: true,
        data: notes,
        count: notes.length,
      });
    } catch (error) {
      console.error('Error fetching notes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notes',
      });
    }
  },

  // Get a single note
  async getNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const note = await Note.findOne({ _id: id, userId });

      if (!note) {
        return res.status(404).json({
          success: false,
          error: 'Note not found',
        });
      }

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      console.error('Error fetching note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch note',
      });
    }
  },

  // Create a new note
  async createNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const noteData = {
        ...req.body,
        userId,
      };

      const note = new Note(noteData);
      await note.save();

      res.status(201).json({
        success: true,
        data: note,
        message: 'Note created successfully',
      });
    } catch (error) {
      console.error('Error creating note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create note',
      });
    }
  },

  // Update a note
  async updateNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const updates = req.body;

      delete updates.userId;

      // Pre-calculate word and character count if content is being updated
      if (updates.content) {
        updates.charCount = updates.content.length;
        const words = updates.content.trim().split(/\s+/);
        updates.wordCount = words.filter((word: string) => word.length > 0).length;
      }

      const note = await Note.findOneAndUpdate(
        { _id: id, userId },
        updates,
        { new: true, runValidators: true }
      );

      if (!note) {
        return res.status(404).json({
          success: false,
          error: 'Note not found',
        });
      }

      res.json({
        success: true,
        data: note,
        message: 'Note updated successfully',
      });
    } catch (error) {
      console.error('Error updating note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update note',
      });
    }
  },

  // Delete a note
  async deleteNote(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const note = await Note.findOneAndDelete({ _id: id, userId });

      if (!note) {
        return res.status(404).json({
          success: false,
          error: 'Note not found',
        });
      }

      res.json({
        success: true,
        message: 'Note deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete note',
      });
    }
  },

  // Get notes by category
  async getNotesByCategory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { category } = req.params;

      if (!['personal', 'work', 'idea', 'urgent'].includes(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category',
        });
      }

      const notes = await (Note as any).getNotesByCategory(userId, category);

      res.json({
        success: true,
        data: notes,
        count: notes.length,
      });
    } catch (error) {
      console.error('Error fetching notes by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notes',
      });
    }
  },

  // Get recent notes
  async getRecentNotes(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const limit = parseInt(req.query.limit as string) || 10;

      const notes = await (Note as any).getRecentNotes(userId, limit);

      res.json({
        success: true,
        data: notes,
        count: notes.length,
      });
    } catch (error) {
      console.error('Error fetching recent notes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent notes',
      });
    }
  },

  // Search notes
  async searchNotes(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
      }

      const notes = await (Note as any).searchNotes(userId, query as string);

      res.json({
        success: true,
        data: notes,
        count: notes.length,
      });
    } catch (error) {
      console.error('Error searching notes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search notes',
      });
    }
  },
};