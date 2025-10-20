import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: string;
  type: 'task' | 'event' | 'reminder' | 'system' | 'ai_suggestion' | 'meeting' | 'alert' | 'pattern_detected' | 'forgotten_activity';
  title: string;
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  relatedId?: string; // Reference to task/event/reminder ID
  relatedModel?: 'Task' | 'Event' | 'Reminder' | 'Assignment' | 'Pattern';
  actionUrl?: string; // Deep link to navigate within app
  metadata?: Record<string, any>; // Additional data
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  markAsRead(): Promise<INotification>;
}

export interface INotificationModel extends mongoose.Model<INotification> {
  getUnreadCount(userId: string): Promise<number>;
  getRecent(userId: string, limit?: number): Promise<INotification[]>;
  markAllAsRead(userId: string): Promise<any>;
  deleteAllRead(userId: string): Promise<any>;
  createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    relatedId?: string;
    relatedModel?: string;
    actionUrl?: string;
    metadata?: Record<string, any>;
    expiresAt?: Date;
  }): Promise<INotification>;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['task', 'event', 'reminder', 'system', 'ai_suggestion', 'meeting', 'alert', 'pattern_detected', 'forgotten_activity'],
    required: true,
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  read: { type: Boolean, default: false, index: true },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  relatedId: { type: String },
  relatedModel: {
    type: String,
    enum: ['Task', 'Event', 'Reminder', 'Assignment', 'Pattern'],
  },
  actionUrl: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed },
  expiresAt: { type: Date },
}, {
  timestamps: true,
});

// Indexes for efficient querying
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, priority: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired notifications

// Virtual for checking if notification is expired
NotificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt ? this.expiresAt <= new Date() : false;
});

// Method to mark notification as read
NotificationSchema.methods.markAsRead = function() {
  this.read = true;
  return this.save();
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = function(userId: string) {
  return this.countDocuments({ userId, read: false });
};

// Static method to get recent notifications
NotificationSchema.statics.getRecent = function(userId: string, limit: number = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to mark all as read
NotificationSchema.statics.markAllAsRead = function(userId: string) {
  return this.updateMany({ userId, read: false }, { read: true });
};

// Static method to delete all read notifications
NotificationSchema.statics.deleteAllRead = function(userId: string) {
  return this.deleteMany({ userId, read: true });
};

// Static method to create notification
NotificationSchema.statics.createNotification = async function(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: string;
  relatedId?: string;
  relatedModel?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}) {
  const notification = new this(data);
  await notification.save();

  // TODO: Trigger push notification or socket event here
  // socketService.sendNotification(data.userId, notification);

  return notification;
};

export default mongoose.model<INotification, INotificationModel>('Notification', NotificationSchema);
