import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignment extends Document {
  userId: string;
  title: string;
  description: string;
  query: string; // The original user request
  type: 'research' | 'comparison' | 'recommendation' | 'investigation' | 'analysis';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  findings?: string; // PA's research results
  sources?: string[]; // URLs or references used
  relatedLinks?: string[];
  estimatedCompletionTime?: Date;
  completedAt?: Date;
  notificationSent: boolean;
  viewed?: boolean;
  viewedAt?: Date;
  metadata?: {
    searchQueries?: string[];
    dataPoints?: any[];
    comparisonResults?: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  query: { type: String, required: true },
  type: {
    type: String,
    enum: ['research', 'comparison', 'recommendation', 'investigation', 'analysis'],
    default: 'research',
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  findings: { type: String },
  sources: [{ type: String }],
  relatedLinks: [{ type: String }],
  estimatedCompletionTime: { type: Date },
  completedAt: { type: Date },
  notificationSent: { type: Boolean, default: false },
  viewed: { type: Boolean, default: false },
  viewedAt: { type: Date },
  metadata: {
    searchQueries: [{ type: String }],
    dataPoints: [{ type: Schema.Types.Mixed }],
    comparisonResults: { type: Schema.Types.Mixed },
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
AssignmentSchema.index({ userId: 1, status: 1 });
AssignmentSchema.index({ userId: 1, createdAt: -1 });
AssignmentSchema.index({ userId: 1, completedAt: -1 });

// Method to mark assignment as completed
AssignmentSchema.methods.complete = function(findings: string, sources?: string[]) {
  this.status = 'completed';
  this.findings = findings;
  this.sources = sources || [];
  this.completedAt = new Date();
  return this.save();
};

// Method to update progress
AssignmentSchema.methods.updateProgress = function(status: string) {
  this.status = status;
  return this.save();
};

// Static method to get active assignments
AssignmentSchema.statics.getActiveAssignments = function(userId: string) {
  return this.find({
    userId,
    status: { $in: ['pending', 'in_progress'] }
  }).sort({ createdAt: -1 });
};

// Static method to get completed assignments
AssignmentSchema.statics.getCompletedAssignments = function(userId: string, limit: number = 20) {
  return this.find({
    userId,
    status: 'completed'
  })
    .sort({ completedAt: -1 })
    .limit(limit);
};

export default mongoose.model<IAssignment>('Assignment', AssignmentSchema);
