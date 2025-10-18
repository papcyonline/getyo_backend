import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceNote extends Document {
  userId: string;
  title: string;
  transcript: string;
  audioUrl?: string;
  duration: number; // in seconds
  tags?: string[];
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VoiceNoteSchema = new Schema<IVoiceNote>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  transcript: { type: String, required: true },
  audioUrl: { type: String }, // URL to stored audio file
  duration: { type: Number, required: true }, // Duration in seconds
  tags: [{ type: String, trim: true }],
  location: { type: String, trim: true },
}, {
  timestamps: true,
});

// Indexes for efficient querying
VoiceNoteSchema.index({ userId: 1, createdAt: -1 });
VoiceNoteSchema.index({ userId: 1, tags: 1 });
VoiceNoteSchema.index({ title: 'text', transcript: 'text' }); // For text search

// Static method to get recent voice notes
VoiceNoteSchema.statics.getRecentVoiceNotes = function(userId: string, limit: number = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to search voice notes
VoiceNoteSchema.statics.searchVoiceNotes = function(userId: string, query: string) {
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

// Virtual for snippet (first 100 characters of transcript)
VoiceNoteSchema.virtual('snippet').get(function() {
  return this.transcript.length > 100
    ? this.transcript.substring(0, 100) + '...'
    : this.transcript;
});

export default mongoose.model<IVoiceNote>('VoiceNote', VoiceNoteSchema);
