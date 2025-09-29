import mongoose, { Schema } from 'mongoose';
import { ITask } from '../types';

const TaskSchema = new Schema<ITask>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  dueDate: { type: Date },
  reminders: [{ type: Date }],
  tags: [{ type: String, trim: true }],
  createdBy: { type: String, enum: ['user', 'ai_suggestion'], default: 'user' },
}, {
  timestamps: true,
});

// Index for efficient querying
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ userId: 1, priority: 1 });
TaskSchema.index({ userId: 1, dueDate: 1 });

// Virtual for overdue tasks
TaskSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.dueDate < new Date() && this.status !== 'completed';
});

// Method to mark task as completed
TaskSchema.methods.markCompleted = function() {
  this.status = 'completed';
  return this.save();
};

// Static method to get user's pending tasks
TaskSchema.statics.getPendingTasks = function(userId: string) {
  return this.find({ userId, status: { $ne: 'completed' } })
    .sort({ priority: -1, dueDate: 1 });
};

// Static method to get high priority tasks
TaskSchema.statics.getHighPriorityTasks = function(userId: string) {
  return this.find({ userId, priority: 'high', status: { $ne: 'completed' } })
    .sort({ dueDate: 1 });
};

export default mongoose.model<ITask>('Task', TaskSchema);