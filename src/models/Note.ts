import mongoose, { Schema, Document } from 'mongoose';

export interface INote extends Document {
  userId: string;
  title: string;
  content: string;
  category: 'personal' | 'work' | 'idea' | 'urgent';
  tags?: string[];
  wordCount: number;
  charCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  category: {
    type: String,
    enum: ['personal', 'work', 'idea', 'urgent'],
    default: 'personal'
  },
  tags: [{ type: String, trim: true }],
  wordCount: { type: Number, default: 0 },
  charCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Indexes for efficient querying
NoteSchema.index({ userId: 1, category: 1 });
NoteSchema.index({ userId: 1, createdAt: -1 });
NoteSchema.index({ userId: 1, tags: 1 });
NoteSchema.index({ title: 'text', content: 'text' }); // For text search

// Pre-save hook to calculate word and character count
NoteSchema.pre('save', function(next) {
  if (this.content) {
    this.charCount = this.content.length;
    const words = this.content.trim().split(/\s+/);
    this.wordCount = words.filter(word => word.length > 0).length;
  }
  next();
});

// Static method to search notes
NoteSchema.statics.searchNotes = function(userId: string, query: string) {
  return this.find(
    {
      userId,
      $text: { $search: query }
    },
    {
      score: { $meta: 'textScore' }
    }
  ).sort({ score: { $meta: 'textScore' } });
};

// Static method to get notes by category
NoteSchema.statics.getNotesByCategory = function(userId: string, category: string) {
  return this.find({ userId, category }).sort({ createdAt: -1 });
};

// Static method to get recent notes
NoteSchema.statics.getRecentNotes = function(userId: string, limit: number = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Virtual for snippet (first 200 characters of content)
NoteSchema.virtual('snippet').get(function() {
  return this.content.length > 200
    ? this.content.substring(0, 200) + '...'
    : this.content;
});

export default mongoose.model<INote>('Note', NoteSchema);