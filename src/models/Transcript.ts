import mongoose, { Schema } from 'mongoose';
import { ITranscript } from '../types';

const TranscriptSchema = new Schema<ITranscript>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  actionItems: [{ type: String, trim: true }],
  participants: [{ type: String, trim: true }],
  duration: { type: Number, required: true }, // Duration in seconds
  recordedAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// Index for efficient querying
TranscriptSchema.index({ userId: 1, recordedAt: -1 });
TranscriptSchema.index({ userId: 1, createdAt: -1 });

// Virtual for duration in human-readable format
TranscriptSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.duration / 3600);
  const minutes = Math.floor((this.duration % 3600) / 60);
  const seconds = this.duration % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

// Virtual for word count estimate
TranscriptSchema.virtual('wordCount').get(function() {
  return this.content.split(/\s+/).filter(word => word.length > 0).length;
});

// Method to extract keywords from content
TranscriptSchema.methods.extractKeywords = function(limit: number = 10) {
  // Simple keyword extraction (in production, use a proper NLP library)
  const words = this.content.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word: string) => word.length > 3);

  const wordCount = words.reduce((acc: Record<string, number>, word: string) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(wordCount)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, limit)
    .map(([word]) => word);
};

// Method to search content
TranscriptSchema.methods.searchContent = function(query: string) {
  const regex = new RegExp(query, 'gi');
  const matches = this.content.match(regex);
  return {
    found: matches !== null,
    count: matches ? matches.length : 0,
    highlights: matches || [],
  };
};

// Static method to search user's transcripts
TranscriptSchema.statics.searchUserTranscripts = function(userId: string, query: string) {
  return this.find({
    userId,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { actionItems: { $elemMatch: { $regex: query, $options: 'i' } } },
    ],
  }).sort({ recordedAt: -1 });
};

// Static method to get recent transcripts
TranscriptSchema.statics.getRecentTranscripts = function(userId: string, limit: number = 10) {
  return this.find({ userId })
    .sort({ recordedAt: -1 })
    .limit(limit);
};

// Static method to get transcripts with action items
TranscriptSchema.statics.getTranscriptsWithActionItems = function(userId: string) {
  return this.find({
    userId,
    actionItems: { $exists: true, $not: { $size: 0 } },
  }).sort({ recordedAt: -1 });
};

export default mongoose.model<ITranscript>('Transcript', TranscriptSchema);