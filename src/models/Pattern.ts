import mongoose, { Document, Schema } from 'mongoose';

export interface IPattern extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'reminder' | 'task' | 'call' | 'activity' | 'event';
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  timing: {
    hour: number; // 0-23
    minute: number; // 0-59
    dayOfWeek?: number; // 0-6 (0=Sunday) for weekly patterns
    dayOfMonth?: number; // 1-31 for monthly patterns
    customDays?: number[]; // For custom patterns (e.g., Mon/Wed/Fri)
  };
  occurrences: number; // How many times this pattern has occurred
  consistency: number; // 0-1 (percentage of time pattern is followed)
  lastOccurrence: Date;
  firstDetected: Date;
  autoCreated: boolean; // Whether recurring reminders are auto-created
  userResponse: 'accepted' | 'declined' | 'pending';
  priority: 'critical' | 'high' | 'medium' | 'low';
  metadata: {
    originalTaskIds?: mongoose.Types.ObjectId[]; // Original tasks/reminders that formed this pattern
    missedCount?: number; // Times user missed this pattern
    automationOfferedAt?: Date; // When we first offered automation
    declinedAt?: Date; // When user declined automation
  };
  createdAt: Date;
  updatedAt: Date;

  // Method declarations
  shouldRemindToday(): boolean;
  getScheduledTime(): Date;
  getTimeSinceScheduled(): number;
  isForgotten(gracePeriodMinutes?: number): boolean;
  updateOccurrence(): void;
}

const patternSchema = new Schema<IPattern>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['reminder', 'task', 'call', 'activity', 'event'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      required: true,
      default: 'daily',
    },
    timing: {
      hour: {
        type: Number,
        required: true,
        min: 0,
        max: 23,
      },
      minute: {
        type: Number,
        required: true,
        min: 0,
        max: 59,
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
      },
      customDays: [{
        type: Number,
        min: 0,
        max: 6,
      }],
    },
    occurrences: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    consistency: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1,
    },
    lastOccurrence: {
      type: Date,
      required: true,
    },
    firstDetected: {
      type: Date,
      required: true,
      default: Date.now,
    },
    autoCreated: {
      type: Boolean,
      default: false,
    },
    userResponse: {
      type: String,
      enum: ['accepted', 'declined', 'pending'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    metadata: {
      originalTaskIds: [{
        type: Schema.Types.ObjectId,
      }],
      missedCount: {
        type: Number,
        default: 0,
      },
      automationOfferedAt: Date,
      declinedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
patternSchema.index({ userId: 1, type: 1, frequency: 1 });
patternSchema.index({ userId: 1, autoCreated: 1 });
patternSchema.index({ userId: 1, userResponse: 1 });
patternSchema.index({ userId: 1, priority: 1 });
patternSchema.index({ 'timing.hour': 1, 'timing.minute': 1 }); // For time-based queries

// Methods
patternSchema.methods.shouldRemindToday = function(this: IPattern): boolean {
  const now = new Date();
  const currentDay = now.getDay(); // 0-6
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Check if today is a pattern day
  if (this.frequency === 'daily') {
    return true;
  } else if (this.frequency === 'weekly') {
    return this.timing.dayOfWeek === currentDay;
  } else if (this.frequency === 'monthly') {
    return this.timing.dayOfMonth === now.getDate();
  } else if (this.frequency === 'custom' && this.timing.customDays) {
    return this.timing.customDays.includes(currentDay);
  }

  return false;
};

patternSchema.methods.getScheduledTime = function(this: IPattern): Date {
  const now = new Date();
  const scheduledTime = new Date(now);
  scheduledTime.setHours(this.timing.hour);
  scheduledTime.setMinutes(this.timing.minute);
  scheduledTime.setSeconds(0);
  scheduledTime.setMilliseconds(0);

  return scheduledTime;
};

patternSchema.methods.getTimeSinceScheduled = function(this: IPattern): number {
  const scheduledTime = this.getScheduledTime();
  const now = new Date();
  return now.getTime() - scheduledTime.getTime();
};

patternSchema.methods.isForgotten = function(this: IPattern, gracePeriodMinutes: number = 15): boolean {
  // Check if pattern should occur today
  if (!this.shouldRemindToday()) {
    return false;
  }

  const timeSinceScheduled = this.getTimeSinceScheduled();
  const gracePeriodMs = gracePeriodMinutes * 60 * 1000;

  // Forgotten if past scheduled time + grace period and hasn't occurred today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastOccurrenceToday = this.lastOccurrence &&
    this.lastOccurrence >= today;

  return timeSinceScheduled > gracePeriodMs && !lastOccurrenceToday;
};

patternSchema.methods.updateOccurrence = function(this: IPattern): void {
  this.occurrences += 1;
  this.lastOccurrence = new Date();

  // Recalculate consistency (simplified - can be enhanced)
  // Consistency = occurrences / expected occurrences based on time since first detected
  const daysSinceDetection = Math.floor(
    (Date.now() - this.firstDetected.getTime()) / (1000 * 60 * 60 * 24)
  );

  let expectedOccurrences = 0;
  if (this.frequency === 'daily') {
    expectedOccurrences = daysSinceDetection;
  } else if (this.frequency === 'weekly') {
    expectedOccurrences = Math.floor(daysSinceDetection / 7);
  } else if (this.frequency === 'monthly') {
    expectedOccurrences = Math.floor(daysSinceDetection / 30);
  } else if (this.frequency === 'custom' && this.timing.customDays) {
    // For custom (e.g., 3 days a week)
    expectedOccurrences = Math.floor(
      (daysSinceDetection / 7) * this.timing.customDays.length
    );
  }

  if (expectedOccurrences > 0) {
    this.consistency = Math.min(this.occurrences / expectedOccurrences, 1);
  }
};

const Pattern = mongoose.model<IPattern>('Pattern', patternSchema);

export default Pattern;
