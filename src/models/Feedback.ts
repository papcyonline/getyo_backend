import mongoose, { Schema, Document } from 'mongoose';

/**
 * FEEDBACK MODEL - User Rating & Response Quality Tracking
 *
 * Collects user feedback on PA responses for:
 * - Quality improvement
 * - Fine-tuning training data
 * - Error detection
 * - Learning what users like/dislike
 */

export interface IFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  messageId: mongoose.Types.ObjectId;

  // The message that was rated
  userMessage: string;
  paResponse: string;

  // Feedback
  rating: number; // 1-5 stars
  feedbackType: 'positive' | 'negative' | 'neutral';
  specificIssue?: 'incorrect_action' | 'wrong_tone' | 'missing_info' | 'too_long' | 'too_short' | 'misunderstood' | 'other';

  // What user expected vs what they got
  expectedResponse?: string; // Optional: What user wished PA said
  correctedAction?: string; // Optional: What action should have been taken

  // Actions created (for tracking accuracy)
  actionsCreated: Array<{
    type: 'task' | 'reminder' | 'note' | 'assignment';
    title: string;
    wasCorrect: boolean; // Did user confirm it was right?
  }>;

  // Context
  needsClarification: boolean;
  clarificationProvided: boolean;

  // Metadata
  responseTimeMs: number;
  promptTokens?: number;
  completionTokens?: number;

  createdAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  messageId: {
    type: Schema.Types.ObjectId,
    required: true,
  },

  // Messages
  userMessage: {
    type: String,
    required: true,
  },
  paResponse: {
    type: String,
    required: true,
  },

  // Rating
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  feedbackType: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    required: true,
  },
  specificIssue: {
    type: String,
    enum: ['incorrect_action', 'wrong_tone', 'missing_info', 'too_long', 'too_short', 'misunderstood', 'other'],
  },

  // Corrections
  expectedResponse: {
    type: String,
  },
  correctedAction: {
    type: String,
  },

  // Actions tracking
  actionsCreated: [{
    type: {
      type: String,
      enum: ['task', 'reminder', 'note', 'assignment'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    wasCorrect: {
      type: Boolean,
      default: true,
    },
  }],

  // Context
  needsClarification: {
    type: Boolean,
    default: false,
  },
  clarificationProvided: {
    type: Boolean,
    default: false,
  },

  // Performance
  responseTimeMs: {
    type: Number,
    required: true,
  },
  promptTokens: {
    type: Number,
  },
  completionTokens: {
    type: Number,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Index for analytics queries
FeedbackSchema.index({ userId: 1, rating: 1, createdAt: -1 });
FeedbackSchema.index({ feedbackType: 1, createdAt: -1 });

// Static method to get high-quality examples for fine-tuning
FeedbackSchema.statics.getHighQualityExamples = async function(limit: number = 100) {
  return this.find({
    rating: { $gte: 4 }, // 4-5 stars only
    feedbackType: 'positive',
  })
    .sort({ rating: -1, createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get problematic examples for improvement
FeedbackSchema.statics.getProblematicExamples = async function(limit: number = 100) {
  return this.find({
    rating: { $lte: 2 }, // 1-2 stars
    feedbackType: 'negative',
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to calculate average rating for a user
FeedbackSchema.statics.getUserAverageRating = async function(userId: mongoose.Types.ObjectId) {
  const result = await this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalFeedback: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { average: result[0].averageRating, total: result[0].totalFeedback }
    : { average: 0, total: 0 };
};

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);
