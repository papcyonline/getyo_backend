import mongoose, { Schema, Document } from 'mongoose';

export interface IReminder extends Document {
  userId: string;
  title: string;
  notes?: string;
  reminderTime: Date;
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly';
  isUrgent: boolean;
  status: 'active' | 'completed' | 'snoozed' | 'cancelled';
  snoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  snooze(minutes: number): Promise<IReminder>;
  markCompleted(): Promise<IReminder>;
}

const ReminderSchema = new Schema<IReminder>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  notes: { type: String, trim: true },
  reminderTime: { type: Date, required: true },
  repeatType: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none'
  },
  isUrgent: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['active', 'completed', 'snoozed', 'cancelled'],
    default: 'active'
  },
  snoozedUntil: { type: Date },
}, {
  timestamps: true,
});

// Indexes for efficient querying
ReminderSchema.index({ userId: 1, status: 1 });
ReminderSchema.index({ userId: 1, reminderTime: 1 });
ReminderSchema.index({ reminderTime: 1, status: 1 });

// Virtual for checking if reminder is due
ReminderSchema.virtual('isDue').get(function() {
  return this.reminderTime <= new Date() && this.status === 'active';
});

// Method to snooze reminder
ReminderSchema.methods.snooze = function(minutes: number) {
  const snoozeTime = new Date();
  snoozeTime.setMinutes(snoozeTime.getMinutes() + minutes);

  this.status = 'snoozed';
  this.snoozedUntil = snoozeTime;
  this.reminderTime = snoozeTime;

  return this.save();
};

// Method to mark as completed
ReminderSchema.methods.markCompleted = function() {
  this.status = 'completed';
  return this.save();
};

// Static method to get upcoming reminders
ReminderSchema.statics.getUpcomingReminders = function(userId: string, hours: number = 24) {
  const now = new Date();
  const future = new Date();
  future.setHours(future.getHours() + hours);

  return this.find({
    userId,
    status: 'active',
    reminderTime: { $gte: now, $lte: future }
  }).sort({ reminderTime: 1 });
};

// Static method to get overdue reminders
ReminderSchema.statics.getOverdueReminders = function(userId: string) {
  return this.find({
    userId,
    status: 'active',
    reminderTime: { $lt: new Date() }
  }).sort({ reminderTime: 1 });
};

export default mongoose.model<IReminder>('Reminder', ReminderSchema);