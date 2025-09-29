import mongoose, { Schema } from 'mongoose';
import { IEvent } from '../types';

const EventSchema = new Schema<IEvent>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  location: { type: String, trim: true },
  attendees: [{ type: String, trim: true }],
  reminders: [{ type: Date }],
  source: { type: String, enum: ['manual', 'google_cal', 'apple_cal'], default: 'manual' },
}, {
  timestamps: true,
});

// Indexes for efficient querying
EventSchema.index({ userId: 1, startTime: 1 });
EventSchema.index({ userId: 1, endTime: 1 });
EventSchema.index({ userId: 1, source: 1 });

// Validation: endTime must be after startTime
EventSchema.pre('validate', function(next) {
  if (this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after start time');
  }
  next();
});

// Virtual for event duration in minutes
EventSchema.virtual('durationMinutes').get(function() {
  return Math.round((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60));
});

// Virtual for checking if event is today
EventSchema.virtual('isToday').get(function() {
  const today = new Date();
  const eventDate = new Date(this.startTime);
  return eventDate.toDateString() === today.toDateString();
});

// Virtual for checking if event is upcoming (within next 2 hours)
EventSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return this.startTime <= twoHoursFromNow && this.startTime > now;
});

// Static method to get today's events for a user
EventSchema.statics.getTodayEvents = function(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    userId,
    startTime: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ startTime: 1 });
};

// Static method to get upcoming events
EventSchema.statics.getUpcomingEvents = function(userId: string, hours: number = 24) {
  const now = new Date();
  const futureTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return this.find({
    userId,
    startTime: { $gte: now, $lte: futureTime }
  }).sort({ startTime: 1 });
};

// Static method to check for conflicts
EventSchema.statics.findConflicts = function(userId: string, startTime: Date, endTime: Date, excludeId?: string) {
  const query: any = {
    userId,
    $or: [
      // New event starts during existing event
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      // New event ends during existing event
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      // New event encompasses existing event
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return this.find(query);
};

export default mongoose.model<IEvent>('Event', EventSchema);