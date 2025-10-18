import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string; // Hashed token for security
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'web';
  deviceInfo: {
    os?: string;
    browser?: string;
    appVersion?: string;
    platform?: string;
  };
  ipAddress: string;
  location: {
    city?: string;
    country?: string;
    countryCode?: string;
    region?: string;
    timezone?: string;
  };
  userAgent: string;
  lastActive: Date;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  isValid(): boolean;
  extendExpiry(hours?: number): Promise<ISession>;
}

const SessionSchema = new Schema<ISession>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  deviceName: {
    type: String,
    required: true,
    trim: true,
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet', 'web'],
    default: 'web',
  },
  deviceInfo: {
    os: { type: String },
    browser: { type: String },
    appVersion: { type: String },
    platform: { type: String },
  },
  ipAddress: {
    type: String,
    required: true,
  },
  location: {
    city: { type: String },
    country: { type: String },
    countryCode: { type: String },
    region: { type: String },
    timezone: { type: String },
  },
  userAgent: {
    type: String,
    required: true,
  },
  lastActive: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
SessionSchema.index({ userId: 1, isActive: 1 });
SessionSchema.index({ userId: 1, lastActive: -1 });
SessionSchema.index({ token: 1, isActive: 1 });

// TTL index to automatically delete expired sessions after 7 days
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Static method to get active sessions for a user
SessionSchema.statics.getActiveSessions = function(userId: string) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActive: -1 });
};

// Static method to terminate a specific session
SessionSchema.statics.terminateSession = async function(sessionId: string, userId: string) {
  const session = await this.findOne({ _id: sessionId, userId });
  if (!session) {
    throw new Error('Session not found');
  }
  session.isActive = false;
  await session.save();
  return session;
};

// Static method to terminate all other sessions (keep current)
SessionSchema.statics.terminateAllOtherSessions = async function(currentToken: string, userId: string) {
  const result = await this.updateMany(
    {
      userId,
      token: { $ne: currentToken },
      isActive: true
    },
    {
      isActive: false,
      updatedAt: new Date()
    }
  );
  return result;
};

// Static method to update session activity
SessionSchema.statics.updateActivity = async function(token: string) {
  return this.findOneAndUpdate(
    { token, isActive: true },
    { lastActive: new Date() },
    { new: true }
  );
};

// Static method to cleanup expired sessions
SessionSchema.statics.cleanupExpiredSessions = async function() {
  const result = await this.updateMany(
    {
      isActive: true,
      expiresAt: { $lt: new Date() }
    },
    {
      isActive: false,
      updatedAt: new Date()
    }
  );
  return result;
};

// Instance method to check if session is valid
SessionSchema.methods.isValid = function(): boolean {
  return this.isActive && this.expiresAt > new Date();
};

// Instance method to extend session expiry
SessionSchema.methods.extendExpiry = async function(hours: number = 24) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  this.lastActive = new Date();
  await this.save();
  return this;
};

export default mongoose.model<ISession>('Session', SessionSchema);
