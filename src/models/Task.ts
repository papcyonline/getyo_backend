import mongoose, { Schema } from 'mongoose';
import { ITask, ISubtask, IReminder, IRecurrence, ILocation } from '../types';

const SubtaskSchema = new Schema<ISubtask>({
  id: { type: String, required: true },
  text: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const ReminderSchema = new Schema<IReminder>({
  id: { type: String, required: true },
  dateTime: { type: Date, required: true },
  type: {
    type: String,
    enum: ['once', 'daily', 'weekly', 'monthly'],
    default: 'once'
  },
  enabled: { type: Boolean, default: true },
}, { _id: false });

const RecurrenceSchema = new Schema<IRecurrence>({
  enabled: { type: Boolean, default: false },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true
  },
  interval: { type: Number, default: 1, min: 1 },
  endDate: { type: Date },
  daysOfWeek: [{ type: String }], // For weekly recurrence
  dayOfMonth: { type: Number, min: 1, max: 31 }, // For monthly recurrence
}, { _id: false });

const LocationSchema = new Schema<ILocation>({
  name: { type: String, required: true, trim: true },
  latitude: { type: Number },
  longitude: { type: Number },
  address: { type: String, trim: true },
}, { _id: false });

const TaskSchema = new Schema<ITask>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  category: { type: String, trim: true },
  tags: [{ type: String, trim: true }],

  // Date & Time
  dueDate: { type: Date, index: true },
  completedAt: { type: Date },
  reminders: [ReminderSchema],
  recurrence: RecurrenceSchema,

  // Media
  images: [{ type: String }],
  location: LocationSchema,

  // Voice Recording
  audioUrl: { type: String },
  transcript: { type: String },
  audioDuration: { type: Number }, // in seconds

  // Organization
  subtasks: [SubtaskSchema],

  // Metadata
  createdBy: {
    type: String,
    enum: ['user', 'ai', 'voice'],
    default: 'user'
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
TaskSchema.index({ userId: 1, createdAt: -1 });
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ userId: 1, priority: 1 });
TaskSchema.index({ userId: 1, dueDate: 1 });
TaskSchema.index({ userId: 1, category: 1 });
TaskSchema.index({ userId: 1, tags: 1 });
TaskSchema.index({ title: 'text', description: 'text' }); // For text search

// Static method to get tasks by status
TaskSchema.statics.getTasksByStatus = function(userId: string, status: string) {
  return this.find({ userId, status })
    .sort({ dueDate: 1, priority: -1, createdAt: -1 });
};

// Static method to get overdue tasks
TaskSchema.statics.getOverdueTasks = function(userId: string) {
  return this.find({
    userId,
    status: { $in: ['pending', 'in-progress'] },
    dueDate: { $lt: new Date() }
  }).sort({ dueDate: 1 });
};

// Static method to get upcoming tasks (due within next 7 days)
TaskSchema.statics.getUpcomingTasks = function(userId: string, days: number = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return this.find({
    userId,
    status: { $in: ['pending', 'in-progress'] },
    dueDate: { $gte: new Date(), $lte: endDate }
  }).sort({ dueDate: 1 });
};

// Static method to search tasks
TaskSchema.statics.searchTasks = function(userId: string, query: string) {
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

// Virtual for progress percentage (based on subtasks)
TaskSchema.virtual('progress').get(function() {
  if (!this.subtasks || this.subtasks.length === 0) {
    return this.status === 'completed' ? 100 : 0;
  }
  const completedSubtasks = this.subtasks.filter((st: ISubtask) => st.completed).length;
  return Math.round((completedSubtasks / this.subtasks.length) * 100);
});

// Virtual to check if task is overdue
TaskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > this.dueDate;
});

// Method to mark task as completed
TaskSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method to add subtask
TaskSchema.methods.addSubtask = function(text: string) {
  const subtask: ISubtask = {
    id: new mongoose.Types.ObjectId().toString(),
    text,
    completed: false,
    createdAt: new Date(),
  };
  this.subtasks = this.subtasks || [];
  this.subtasks.push(subtask);
  return this.save();
};

// Method to toggle subtask completion
TaskSchema.methods.toggleSubtask = function(subtaskId: string) {
  const subtask = this.subtasks?.find((st: ISubtask) => st.id === subtaskId);
  if (subtask) {
    subtask.completed = !subtask.completed;
    return this.save();
  }
  throw new Error('Subtask not found');
};

// Pre-save hook to auto-update status based on subtasks
TaskSchema.pre('save', function(next) {
  if (this.subtasks && this.subtasks.length > 0) {
    const allCompleted = this.subtasks.every((st: ISubtask) => st.completed);
    if (allCompleted && this.status !== 'completed') {
      this.status = 'in-progress'; // User can manually mark as completed
    }
  }
  next();
});

export default mongoose.model<ITask>('Task', TaskSchema);